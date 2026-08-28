import { Controller } from '@nestjs/common';
import {
  type GetNonceRequest,
  type GetNonceResponse,
  type VerifySiweRequest,
  type AuthResponse,
  type RefreshTokensRequest,
  type LogoutRequest,
  type LogoutResponse,
  type ValidateTokenRequest,
  type ValidateTokenResponse,
  IdentityServiceControllerMethods,
} from '@app/contracts';
import { AuthService } from './auth.service';

/**
 * gRPC controller implementing authentication RPC endpoints
 * defined in the `identity.IdentityService` protobuf definition.
 */
@Controller()
@IdentityServiceControllerMethods()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Generates a single-use SIWE nonce for a wallet address.
   *
   * @param data - Request payload containing the EVM wallet address
   * @returns Generated nonce with expiration timestamp
   */
  async getNonce(data: GetNonceRequest): Promise<GetNonceResponse> {
    return this.authService.getNonce(data.walletAddress);
  }

  /**
   * Verifies an EIP-4361 SIWE signature, registers/authenticates the user,
   * and returns JWT Access and Refresh tokens.
   *
   * @param data - Request payload with raw SIWE message and hex signature
   * @returns Authentication tokens and user profile
   */
  async verifySiwe(data: VerifySiweRequest): Promise<AuthResponse> {
    return this.authService.verifySiwe(data.message, data.signature);
  }

  /**
   * Rotates access and refresh tokens.
   *
   * @param data - Request payload containing the active refresh token
   * @returns Newly generated token pair and user profile
   */
  async refreshTokens(data: RefreshTokensRequest): Promise<AuthResponse> {
    return this.authService.refreshTokens(data.refreshToken);
  }

  /**
   * Revokes a user session (logout).
   *
   * @param data - Request payload containing refresh token and optional user ID
   * @returns Object indicating success status
   */
  async logout(data: LogoutRequest): Promise<LogoutResponse> {
    const success = await this.authService.logout(data.refreshToken, data.userId);
    return { success };
  }

  /**
   * Validates a JWT access token for internal services.
   *
   * @param data - Request payload containing the raw JWT token string
   * @returns Object containing validity status and user claims
   */
  async validateToken(data: ValidateTokenRequest): Promise<ValidateTokenResponse> {
    return this.authService.validateToken(data.token);
  }
}
