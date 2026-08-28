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

@Controller()
@IdentityServiceControllerMethods()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  async getNonce(data: GetNonceRequest): Promise<GetNonceResponse> {
    return this.authService.getNonce(data.walletAddress);
  }

  async verifySiwe(data: VerifySiweRequest): Promise<AuthResponse> {
    return this.authService.verifySiwe(data.message, data.signature);
  }

  async refreshTokens(data: RefreshTokensRequest): Promise<AuthResponse> {
    return this.authService.refreshTokens(data.refreshToken);
  }

  async logout(data: LogoutRequest): Promise<LogoutResponse> {
    const success = await this.authService.logout(data.refreshToken, data.userId);
    return { success };
  }

  async validateToken(data: ValidateTokenRequest): Promise<ValidateTokenResponse> {
    return this.authService.validateToken(data.token);
  }
}
