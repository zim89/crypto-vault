import { Module, Global, OnApplicationShutdown, Logger, Inject } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { DRIZZLE_CLIENT, DATABASE_POOL } from './database.constants';
import { ENV_KEYS } from '../config';

export type DrizzleDB = PostgresJsDatabase<typeof schema>;

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DATABASE_POOL,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const connectionString =
          configService.get<string>(ENV_KEYS.dbUrl) ||
          `postgres://${configService.get<string>(ENV_KEYS.dbUser, 'postgres')}:${configService.get<string>(ENV_KEYS.dbPassword, 'postgres')}@${configService.get<string>(ENV_KEYS.dbHost, 'localhost')}:${configService.get<number>(ENV_KEYS.dbPort, 5432)}/${configService.get<string>(ENV_KEYS.dbName, 'identity_db')}`;

        return postgres(connectionString, {
          max: configService.get<number>(ENV_KEYS.dbMaxConnections, 10),
          idle_timeout: 30,
          connect_timeout: 10,
        });
      },
    },
    {
      provide: DRIZZLE_CLIENT,
      inject: [DATABASE_POOL],
      useFactory: (pool: postgres.Sql) => {
        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DRIZZLE_CLIENT, DATABASE_POOL],
})
export class DatabaseModule implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(
    @Inject(DATABASE_POOL)
    private readonly pool: postgres.Sql,
  ) {}

  async onApplicationShutdown() {
    this.logger.log('Closing database connection pool...');
    await this.pool.end();
  }
}
