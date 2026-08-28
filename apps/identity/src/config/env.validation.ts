import * as Joi from 'joi';
import { ENV_KEYS } from './env.constants';

export const envValidationSchema = Joi.object({
  // App
  [ENV_KEYS.nodeEnv]: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  [ENV_KEYS.identityGrpcUrl]: Joi.string().default('0.0.0.0:50051'),

  // Auth / JWT
  [ENV_KEYS.jwtSecret]: Joi.string().default('super-secret-dev-jwt-key'),
  [ENV_KEYS.jwtExpiresIn]: Joi.string().default('15m'),

  // Database
  [ENV_KEYS.dbUrl]: Joi.string().optional(),
  [ENV_KEYS.dbHost]: Joi.string().default('localhost'),
  [ENV_KEYS.dbPort]: Joi.number().port().default(5432),
  [ENV_KEYS.dbUser]: Joi.string().default('postgres'),
  [ENV_KEYS.dbPassword]: Joi.string().default('postgres'),
  [ENV_KEYS.dbName]: Joi.string().default('identity_db'),
  [ENV_KEYS.dbMaxConnections]: Joi.number().default(10),

  // Redis
  [ENV_KEYS.redisHost]: Joi.string().default('localhost'),
  [ENV_KEYS.redisPort]: Joi.number().port().default(6379),
  [ENV_KEYS.redisPassword]: Joi.string().optional().allow(''),
});
