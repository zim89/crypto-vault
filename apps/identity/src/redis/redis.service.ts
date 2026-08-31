import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GlideClient, TimeUnit } from '@valkey/valkey-glide';
import { ENV_KEYS } from '../config';

/**
 * Service managing In-Memory Redis/Valkey cache and operations:
 * - Connection lifecycle via high-performance Valkey GLIDE driver.
 * - Atomic SIWE nonce caching and single-use retrieval via GETDEL (Replay Attack prevention).
 * - General-purpose key-value caching with optional TTL.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: GlideClient | null = null;
  private readonly logger = new Logger(RedisService.name);

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.initClient();
  }

  /**
   * Initializes the Redis/Valkey GLIDE client connection.
   */
  private async initClient(): Promise<void> {
    const host = this.configService.get<string>(ENV_KEYS.redisHost, 'localhost');
    const port = Number(this.configService.get<number>(ENV_KEYS.redisPort, 6379));
    const password = this.configService.get<string>(ENV_KEYS.redisPassword) || undefined;

    try {
      this.client = await GlideClient.createClient({
        addresses: [{ host, port }],
        credentials: password ? { password } : undefined,
        requestTimeout: 2000,
      });

      this.logger.log(`Connected to Redis/Valkey at ${host}:${port} via GLIDE`);
    } catch (err: unknown) {
      this.logger.error(`Redis/Valkey connection error: ${(err as Error).message}`);
    }
  }

  /**
   * Retrieves the connected GlideClient instance.
   */
  async getClient(): Promise<GlideClient> {
    if (!this.client) {
      await this.initClient();
    }
    if (!this.client) {
      throw new Error('Failed to establish Redis/Valkey GLIDE connection');
    }
    return this.client;
  }

  /**
   * Stores a SIWE nonce for a wallet address with an expiration time in seconds.
   *
   * @param walletAddress - The EVM wallet address associated with the nonce
   * @param nonce - The cryptographic random nonce string
   * @param ttlSeconds - Time-to-live in seconds (default: 300 / 5 minutes)
   */
  async setNonce(walletAddress: string, nonce: string, ttlSeconds = 300): Promise<void> {
    const client = await this.getClient();
    const key = `siwe:nonce:${walletAddress.toLowerCase()}`;

    await client.set(key, nonce, {
      expiry: {
        type: TimeUnit.Seconds,
        count: ttlSeconds,
      },
    });
  }

  /**
   * Atomically retrieves and deletes a SIWE nonce to prevent replay attacks.
   *
   * Utilizes the native atomic `GETDEL` command.
   *
   * @param walletAddress - The EVM wallet address to retrieve the nonce for
   * @returns The stored nonce string, or `null` if expired or not found
   */
  async getAndDelNonce(walletAddress: string): Promise<string | null> {
    const client = await this.getClient();
    const key = `siwe:nonce:${walletAddress.toLowerCase()}`;

    const nonce = await client.getdel(key);
    return typeof nonce === 'string' ? nonce : null;
  }

  /**
   * Retrieves a string value by key.
   *
   * @param key - Cache key
   * @returns The cached string value, or `null` if not found
   */
  async get(key: string): Promise<string | null> {
    const client = await this.getClient();
    const value = await client.get(key);
    return typeof value === 'string' ? value : null;
  }

  /**
   * Sets a key-value pair with optional expiration time in seconds.
   *
   * @param key - Cache key
   * @param value - String value to store
   * @param ttlSeconds - Optional time-to-live in seconds
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const client = await this.getClient();

    if (ttlSeconds) {
      await client.set(key, value, {
        expiry: {
          type: TimeUnit.Seconds,
          count: ttlSeconds,
        },
      });
    } else {
      await client.set(key, value);
    }
  }

  /**
   * Deletes a key.
   *
   * @param key - Cache key to delete
   */
  async del(key: string): Promise<void> {
    const client = await this.getClient();
    await client.del([key]);
  }

  /**
   * Lifecycle hook executed on application shutdown.
   * Gracefully terminates the connection.
   */
  onModuleDestroy(): void {
    if (this.client) {
      this.logger.log('Closing Redis/Valkey connection...');
      this.client.close();
    }
  }
}
