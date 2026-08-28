import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { ENV_KEYS } from '../config';

/**
 * Service managing Redis connection and operations:
 * - Connection lifecycle and retry strategies.
 * - Atomic SIWE nonce caching and single-use retrieval (Replay Attack prevention).
 * - General-purpose string caching with optional TTL.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>(ENV_KEYS.redisHost, 'localhost');
    const port = Number(this.configService.get<number>(ENV_KEYS.redisPort, 6379));
    const password = this.configService.get<string>(ENV_KEYS.redisPassword) || undefined;

    this.client = new Redis({
      host,
      port,
      password,
      lazyConnect: false,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => {
        const delay = Math.min(times * 200, 2000);
        return delay;
      },
    });

    this.client.on('connect', () => {
      this.logger.log(`Connected to Redis at ${host}:${port}`);
    });

    this.client.on('error', (err) => {
      this.logger.error(`Redis connection error: ${err.message}`);
    });
  }

  /**
   * Retrieves the raw `ioredis` client instance for advanced operations.
   *
   * @returns The active Redis client instance
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Stores a SIWE nonce for a wallet address with an expiration time.
   *
   * @param walletAddress - The EVM wallet address associated with the nonce
   * @param nonce - The cryptographic random nonce string
   * @param ttlSeconds - Time-to-live in seconds (default: 300 / 5 minutes)
   */
  async setNonce(walletAddress: string, nonce: string, ttlSeconds = 300): Promise<void> {
    const key = `siwe:nonce:${walletAddress.toLowerCase()}`;
    await this.client.set(key, nonce, 'EX', ttlSeconds);
  }

  /**
   * Atomically retrieves and deletes a SIWE nonce to prevent replay attacks.
   *
   * Utilizes the native Redis 6.2+ `GETDEL` command with an automatic fallback
   * to an atomic Lua script for older Redis instances.
   *
   * @param walletAddress - The EVM wallet address to retrieve the nonce for
   * @returns The stored nonce string, or `null` if expired or not found
   */
  async getAndDelNonce(walletAddress: string): Promise<string | null> {
    const key = `siwe:nonce:${walletAddress.toLowerCase()}`;
    try {
      // Redis 6.2+ supports GETDEL natively
      const nonce = (await this.client.call('GETDEL', key)) as string | null;
      return nonce;
    } catch {
      // Fallback for older Redis versions via Lua script
      const luaScript = `
        local val = redis.call('get', KEYS[1])
        if val then
          redis.call('del', KEYS[1])
        end
        return val
      `;
      const nonce = (await this.client.eval(luaScript, 1, key)) as string | null;
      return nonce;
    }
  }

  /**
   * Retrieves a string value by key from Redis.
   *
   * @param key - Cache key
   * @returns The cached string value, or `null` if not found
   */
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /**
   * Sets a key-value pair in Redis with optional expiration time.
   *
   * @param key - Cache key
   * @param value - String value to store
   * @param ttlSeconds - Optional time-to-live in seconds
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  /**
   * Deletes a key from Redis.
   *
   * @param key - Cache key to delete
   */
  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * Lifecycle hook executed on application shutdown.
   * Gracefully terminates the Redis connection.
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing Redis connection...');
    await this.client.quit();
  }
}
