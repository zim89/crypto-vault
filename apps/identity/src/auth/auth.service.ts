import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { verifyMessage, Hex } from 'viem';
import { parseSiweMessage } from 'viem/siwe';
import { AuthResponse, ValidateTokenResponse } from '@app/contracts';
import { User } from '../database/schema/users.schema';
import { UsersService } from '../users/users.service';
import { AUTH_ERRORS, AUTH_LOGS } from './auth.constants';
import { NonceService, GeneratedNonce } from './nonce.service';
import { GeneratedTokens, TokenService } from './token.service';

/**
 * Service orchestrating Web3 authentication workflows:
 * - SIWE (Sign-In with Ethereum, EIP-4361) nonce generation and signature verification.
 * - Automatic user registration / lookup upon successful cryptographic verification.
 * - Token rotation and session termination (logout).
 * - Internal JWT access token validation for other microservices.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly nonceService: NonceService,
    private readonly tokenService: TokenService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Generates a single-use SIWE nonce for a given wallet address.
   *
   * @param walletAddress - The EVM address to generate a nonce for
   * @returns Object containing the nonce and expiration timestamp in Unix seconds
   */
  async getNonce(walletAddress: string): Promise<GeneratedNonce> {
    return this.nonceService.generateNonce(walletAddress);
  }

  /**
   * Verifies a SIWE message and cryptographic signature according to EIP-4361.
   *
   * Workflow:
   * 1. Parses and validates the raw SIWE message structure.
   * 2. Checks message expiration time (if provided).
   * 3. Atomically consumes the nonce from Redis to prevent replay attacks.
   * 4. Verifies the ECDSA signature against the wallet address using `viem`.
   * 5. Finds or registers the user in PostgreSQL.
   * 6. Generates a new Access JWT and Argon2-hashed Refresh Token pair.
   *
   * @param rawMessage - Full EIP-4361 formatted text message
   * @param signature - Hex-encoded signature string (0x...)
   * @returns Authentication response containing tokens and user profile
   * @throws {BadRequestException} If message or signature is missing or malformed
   * @throws {UnauthorizedException} If nonce is expired/consumed or signature is invalid
   */
  async verifySiwe(rawMessage: string, signature: string): Promise<AuthResponse> {
    if (!rawMessage || !signature) {
      throw new BadRequestException(AUTH_ERRORS.siweCredentialsRequired);
    }

    // 1. Parse SIWE message
    const parsed = parseSiweMessage(rawMessage);
    if (!parsed || !parsed.address || !parsed.nonce) {
      throw new BadRequestException(AUTH_ERRORS.malformedSiweMessage);
    }

    const walletAddress = this.usersService.normalizeAddress(parsed.address);

    // 2. Validate expiration time if specified in message
    const now = new Date();
    if (parsed.expirationTime && now > parsed.expirationTime) {
      throw new UnauthorizedException(AUTH_ERRORS.siweMessageExpired);
    }

    // 3. Atomically validate & consume nonce (Replay protection)
    const isNonceValid = await this.nonceService.consumeNonce(walletAddress, parsed.nonce);
    if (!isNonceValid) {
      throw new UnauthorizedException(AUTH_ERRORS.invalidNonce);
    }

    // 4. Cryptographic signature verification
    const isSignatureValid = await verifyMessage({
      address: walletAddress as Hex,
      message: rawMessage,
      signature: signature as Hex,
    });

    if (!isSignatureValid) {
      this.logger.warn(AUTH_LOGS.signatureVerificationFailed(walletAddress));
      throw new UnauthorizedException(AUTH_ERRORS.invalidSignature);
    }

    // 5. Find or register user
    const { user } = await this.usersService.findOrCreate(walletAddress);

    // 6. Generate JWT session tokens
    const tokens = await this.tokenService.generateTokens(user);

    return this.mapToAuthResponse(tokens, user);
  }

  /**
   * Rotates tokens using an active Refresh Token.
   *
   * @param refreshToken - The active refresh token string
   * @returns New token pair and user profile
   * @throws {UnauthorizedException} If refresh token is expired, revoked, or invalid
   */
  async refreshTokens(refreshToken: string): Promise<AuthResponse> {
    const { tokens, user } = await this.tokenService.rotateTokens(refreshToken);
    return this.mapToAuthResponse(tokens, user);
  }

  /**
   * Revokes a user session (logout).
   *
   * @param refreshToken - The refresh token of the session to terminate
   * @param userId - Optional user ID to scope the query
   * @returns `true` if the session was found and revoked, `false` otherwise
   * @throws {BadRequestException} If refresh token is missing
   */
  async logout(refreshToken: string, userId?: string): Promise<boolean> {
    if (!refreshToken) {
      throw new BadRequestException(AUTH_ERRORS.refreshTokenRequired);
    }
    return this.tokenService.revokeToken(refreshToken, userId);
  }

  /**
   * Validates an access token and returns payload data.
   * Designed for internal inter-service gRPC communication.
   *
   * @param token - Raw JWT access token
   * @returns Validation response with validity status and extracted user claims
   */
  async validateToken(token: string): Promise<ValidateTokenResponse> {
    try {
      const payload = await this.tokenService.verifyAccessToken(token);
      return {
        isValid: true,
        userId: payload.sub,
        walletAddress: payload.walletAddress,
        role: payload.role,
      };
    } catch {
      return {
        isValid: false,
        userId: '',
        walletAddress: '',
        role: '',
      };
    }
  }

  /**
   * Maps internal domain tokens and user entity to gRPC AuthResponse format.
   *
   * @param tokens - Generated JWT and Refresh token pair
   * @param user - User database entity
   * @returns Formatted AuthResponse object matching proto definition
   */
  private mapToAuthResponse(tokens: GeneratedTokens, user: User): AuthResponse {
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        role: user.role,
        isActive: user.isActive,
        createdAt: Math.floor(user.createdAt.getTime() / 1000),
      },
    };
  }
}
