import { Injectable, Logger } from '@nestjs/common';
import { generateSiweNonce } from 'viem/siwe';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import { AUTH_LOGS } from './auth.constants';

/**
 * Result of a generated SIWE nonce.
 */
export interface GeneratedNonce {
  /** Cryptographically secure random nonce string */
  nonce: string;
  /** Unix timestamp (in seconds) when the nonce expires */
  expiresAt: number;
}

/**
 * Service responsible for the generation, caching, and single-use consumption
 * of Sign-In with Ethereum (EIP-4361) nonces to prevent replay attacks.
 */
@Injectable()
export class NonceService {
  private readonly logger = new Logger(NonceService.name);
  private readonly DEFAULT_NONCE_TTL_SECONDS = 300; // 5 minutes

  constructor(
    private readonly redisService: RedisService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Generates a cryptographically secure SIWE nonce for a wallet address
   * and stores it in Redis with a 5-minute Time-To-Live (TTL).
   *
   * @param walletAddress - The EVM wallet address requesting authentication
   * @returns Object containing the generated nonce and expiration timestamp in Unix seconds
   */
  async generateNonce(walletAddress: string): Promise<GeneratedNonce> {
    const normalizedAddress = this.usersService.normalizeAddress(walletAddress);
    const nonce = generateSiweNonce();
    const expiresAt = Math.floor(Date.now() / 1000) + this.DEFAULT_NONCE_TTL_SECONDS;

    await this.redisService.setNonce(normalizedAddress, nonce, this.DEFAULT_NONCE_TTL_SECONDS);

    return { nonce, expiresAt };
  }

  /**
   * Atomically validates and consumes a SIWE nonce from Redis.
   *
   * By using atomic GETDEL / Lua script in Redis, the nonce is deleted
   * on the first read, guaranteeing that a signature cannot be replayed.
   *
   * @param walletAddress - The EVM wallet address to validate the nonce for
   * @param providedNonce - The nonce string provided in the SIWE message
   * @returns `true` if the nonce was valid, matched, and successfully consumed; `false` otherwise
   */
  async consumeNonce(walletAddress: string, providedNonce: string): Promise<boolean> {
    const normalizedAddress = this.usersService.normalizeAddress(walletAddress);
    const storedNonce = await this.redisService.getAndDelNonce(normalizedAddress);

    if (!storedNonce) {
      this.logger.warn(AUTH_LOGS.nonceExpired(normalizedAddress));
      return false;
    }

    if (storedNonce !== providedNonce) {
      this.logger.warn(AUTH_LOGS.nonceMismatch(normalizedAddress, storedNonce, providedNonce));
      return false;
    }

    return true;
  }
}
