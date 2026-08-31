export const SANDBOX_DEPOSIT_MAX = '1000000';
export const DEFAULT_CURRENCY = 'USDT';
export const SUPPORTED_CURRENCIES = ['USDT'] as const;

export const BALANCES_ERRORS = {
  accountNotFound: (userId: string, currency: string) =>
    `Account not found for user '${userId}' and currency '${currency}'`,
  invalidUserId: 'Invalid user ID format: must be a valid UUID',
  invalidAmount: 'Amount must be a positive decimal number',
  invalidAmountDecimals: 'Amount cannot exceed 8 decimal places',
  depositLimitExceeded: (max: string) => `Deposit amount exceeds sandbox maximum of ${max}`,
  insufficientAvailableBalance: (available: string, required: string) =>
    `Insufficient available balance: requested ${required}, available ${available}`,
  insufficientLockedBalance: (locked: string, required: string) =>
    `Insufficient locked balance: requested ${required}, locked ${locked}`,
  unsupportedCurrency: (currency: string) =>
    `Unsupported currency '${currency}'. Supported currencies: ${SUPPORTED_CURRENCIES.join(', ')}`,
  accountCreateFailed: (userId: string, currency: string) =>
    `Failed to create or find account for user: ${userId} and currency: ${currency}`,
} as const;
