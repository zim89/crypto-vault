import * as Joi from 'joi';
import { ENV_KEYS } from './env.constants';
import { ACCOUNTS_GRPC } from './grpc.constants';

export const envValidationSchema = Joi.object({
  // App
  [ENV_KEYS.nodeEnv]: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  [ENV_KEYS.accountsGrpcUrl]: Joi.string().default(ACCOUNTS_GRPC.defaultUrl),

  // Database
  [ENV_KEYS.dbUrl]: Joi.string().optional(),
  [ENV_KEYS.dbHost]: Joi.string().default('localhost'),
  [ENV_KEYS.dbPort]: Joi.number().port().default(5432),
  [ENV_KEYS.dbUser]: Joi.string().default('postgres'),
  [ENV_KEYS.dbPassword]: Joi.string().default('postgres'),
  [ENV_KEYS.dbName]: Joi.string().default('accounts_db'),
  [ENV_KEYS.dbMaxConnections]: Joi.number().default(10),
});
