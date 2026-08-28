import { Injectable, UnauthorizedException, Inject, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { DRIZZLE_CLIENT } from '../database/database.constants';
import type { DrizzleDB } from '../database/database.module';
import { refreshTokens } from '../database/schema/refresh-tokens.schema';
import { User } from '../database/schema/users.schema';
import { JwtPayload } from '@app/common';
import { UsersService } from '../users/users.service';
import { ENV_KEYS } from '../config';
import { AUTH_ERRORS, AUTH_LOGS } from './auth.constants';

/**
 * Result of a token generation or rotation operation.
 */
export interface GeneratedTokens {
  /** Signed JWT access token for authenticating API requests */
  accessToken: string;
  /** Opaque random refresh token string */
  refreshToken: string;
  /** Access token expiration time in seconds */
  expiresIn: number;
}

/**
 * Service responsible for managing the lifecycle of authentication tokens:
 * - Issuing signed JWT access tokens.
 * - Generating and storing Argon2-hashed refresh tokens in the database.
 * - Rotating refresh tokens with Token Reuse Detection.
 * - Revoking active user sessions upon logout or security breach.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly ACCESS_TOKEN_EXPIRATION_SECONDS = 900; // 15 minutes
  private readonly REFRESH_TOKEN_EXPIRATION_DAYS = 7;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    @Inject(DRIZZLE_CLIENT)
    private readonly db: DrizzleDB,
  ) {}

  /**
   * Generates a new Access Token (JWT) and Refresh Token pair for a user.
   *
   * The refresh token is generated as a secure random hex string,
   * hashed using Argon2, and persisted to the database along with client metadata.
   *
   * @param user - The authenticated user entity
   * @param metadata - Optional client metadata (User-Agent and IP address)
   * @returns Generated access and refresh tokens with expiration details
   */
  async generateTokens(
    user: User,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): Promise<GeneratedTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      walletAddress: user.walletAddress,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: this.ACCESS_TOKEN_EXPIRATION_SECONDS,
      secret: this.configService.get<string>(ENV_KEYS.jwtSecret),
    });

    const rawRefreshToken = randomBytes(40).toString('hex');
    const tokenHash = await argon2.hash(rawRefreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.REFRESH_TOKEN_EXPIRATION_DAYS);

    await this.db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash,
      userAgent: metadata?.userAgent,
      ipAddress: metadata?.ipAddress,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: this.ACCESS_TOKEN_EXPIRATION_SECONDS,
    };
  }

  /**
   * Rotates a refresh token and issues a new token pair.
   *
   * Implements **Token Reuse Detection**: If an already revoked token is used,
   * it indicates potential token theft, and ALL active refresh tokens for the user
   * are immediately revoked to protect the account.
   *
   * @param rawRefreshToken - The raw refresh token string provided by the client
   * @returns Newly generated tokens and the associated user entity
   * @throws {UnauthorizedException} If token is missing, invalid, expired, or compromised
   */
  async rotateTokens(rawRefreshToken: string): Promise<{ tokens: GeneratedTokens; user: User }> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException(AUTH_ERRORS.refreshTokenRequired);
    }

    // Query active and valid tokens
    const allUserTokens = await this.db.select().from(refreshTokens);

    let matchedTokenRecord: (typeof allUserTokens)[0] | null = null;
    for (const record of allUserTokens) {
      const isMatch = await argon2.verify(record.tokenHash, rawRefreshToken);
      if (isMatch) {
        matchedTokenRecord = record;
        break;
      }
    }

    if (!matchedTokenRecord) {
      throw new UnauthorizedException(AUTH_ERRORS.invalidRefreshToken);
    }

    // Reuse Detection: If token is already revoked, revoke ALL tokens for this user
    if (matchedTokenRecord.isRevoked) {
      this.logger.warn(AUTH_LOGS.revokedTokenReuseDetected(matchedTokenRecord.userId));
      await this.revokeAllUserTokens(matchedTokenRecord.userId);
      throw new UnauthorizedException(AUTH_ERRORS.tokenReuseDetected);
    }

    // Check expiration
    if (new Date() > matchedTokenRecord.expiresAt) {
      throw new UnauthorizedException(AUTH_ERRORS.refreshTokenExpired);
    }

    // Revoke old token
    await this.db
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(eq(refreshTokens.id, matchedTokenRecord.id));

    // Fetch user
    const user = await this.usersService.findById(matchedTokenRecord.userId);

    // Issue new pair
    const tokens = await this.generateTokens(user, {
      userAgent: matchedTokenRecord.userAgent || undefined,
      ipAddress: matchedTokenRecord.ipAddress || undefined,
    });

    return { tokens, user };
  }

  /**
   * Revokes a specific refresh token (used during user logout).
   *
   * @param rawRefreshToken - The raw refresh token to revoke
   * @param userId - Optional user ID to narrow down the search query
   * @returns `true` if the token was found and revoked, `false` otherwise
   */
  async revokeToken(rawRefreshToken: string, userId?: string): Promise<boolean> {
    const query = userId
      ? this.db.select().from(refreshTokens).where(eq(refreshTokens.userId, userId))
      : this.db.select().from(refreshTokens);

    const tokens = await query;
    for (const record of tokens) {
      const isMatch = await argon2.verify(record.tokenHash, rawRefreshToken);
      if (isMatch) {
        await this.db
          .update(refreshTokens)
          .set({ isRevoked: true })
          .where(eq(refreshTokens.id, record.id));
        return true;
      }
    }
    return false;
  }

  /**
   * Revokes all active refresh tokens for a specific user, invalidating all sessions.
   *
   * @param userId - The unique identifier of the user
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(eq(refreshTokens.userId, userId));
  }

  /**
   * Verifies and decodes a JWT access token.
   *
   * @param token - The raw JWT access token string
   * @returns Decoded JWT payload containing user ID, wallet address, and role
   * @throws {UnauthorizedException} If the token signature is invalid or expired
   */
  async verifyAccessToken(token: string): Promise<JwtPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>(ENV_KEYS.jwtSecret),
      });
      return payload;
    } catch {
      throw new UnauthorizedException(AUTH_ERRORS.invalidAccessToken);
    }
  }
}
