export const ENV_KEYS = {
  // App
  nodeEnv: 'NODE_ENV',
  accountsGrpcUrl: 'ACCOUNTS_GRPC_URL',

  // Database
  dbUrl: 'DATABASE_URL',
  dbHost: 'DB_HOST',
  dbPort: 'DB_PORT',
  dbUser: 'DB_USER',
  dbPassword: 'DB_PASSWORD',
  dbName: 'DB_NAME',
  dbMaxConnections: 'DB_MAX_CONNECTIONS',
} as const;

export type EnvKey = (typeof ENV_KEYS)[keyof typeof ENV_KEYS];
