export const ENV_KEYS = {
  // App
  nodeEnv: 'NODE_ENV',
  identityGrpcUrl: 'IDENTITY_GRPC_URL',

  // Auth / JWT
  jwtSecret: 'JWT_SECRET',
  jwtExpiresIn: 'JWT_EXPIRES_IN',

  // Database
  dbUrl: 'DATABASE_URL',
  dbHost: 'DB_HOST',
  dbPort: 'DB_PORT',
  dbUser: 'DB_USER',
  dbPassword: 'DB_PASSWORD',
  dbName: 'DB_NAME',
  dbMaxConnections: 'DB_MAX_CONNECTIONS',

  // Redis
  redisHost: 'REDIS_HOST',
  redisPort: 'REDIS_PORT',
  redisPassword: 'REDIS_PASSWORD',
} as const;

export type EnvKey = (typeof ENV_KEYS)[keyof typeof ENV_KEYS];
