import { Controller } from '@nestjs/common';
import {
  type GetBalanceRequest,
  type DepositSandboxFundsRequest,
  type LockBalanceRequest,
  type UnlockBalanceRequest,
  type BalanceResponse,
  AccountsServiceControllerMethods,
} from '@app/contracts';
import { Account } from '../database/schema/accounts.schema';
import { BalancesService } from './balances.service';

@Controller()
@AccountsServiceControllerMethods()
export class BalancesController {
  constructor(private readonly balancesService: BalancesService) {}

  async getBalance(data: GetBalanceRequest): Promise<BalanceResponse> {
    const account = await this.balancesService.getBalance(data);
    return this.mapToBalanceResponse(account);
  }

  async depositSandboxFunds(data: DepositSandboxFundsRequest): Promise<BalanceResponse> {
    const account = await this.balancesService.depositSandboxFunds(data);
    return this.mapToBalanceResponse(account);
  }

  async lockBalance(data: LockBalanceRequest): Promise<BalanceResponse> {
    const account = await this.balancesService.lockBalance(data);
    return this.mapToBalanceResponse(account);
  }

  async unlockBalance(data: UnlockBalanceRequest): Promise<BalanceResponse> {
    const account = await this.balancesService.unlockBalance(data);
    return this.mapToBalanceResponse(account);
  }

  private mapToBalanceResponse(account: Account): BalanceResponse {
    return {
      accountId: account.id,
      userId: account.userId,
      currency: account.currency,
      availableBalance: account.availableBalance,
      lockedBalance: account.lockedBalance,
      totalBalance: this.balancesService.calculateTotalBalance(
        account.availableBalance,
        account.lockedBalance,
      ),
      updatedAt: Math.floor(account.updatedAt.getTime() / 1000),
    };
  }
}
