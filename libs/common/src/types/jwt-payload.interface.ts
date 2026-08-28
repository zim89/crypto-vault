/**
 * Payload structure encoded inside the JWT access token.
 */
export interface JwtPayload {
  /** User identifier (UUIDv7) */
  sub: string;
  /** Normalized EVM wallet address */
  walletAddress: string;
  /** Role assigned to the user (e.g. 'trader', 'admin') */
  role: string;
}
