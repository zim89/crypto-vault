import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BalancesModule } from './balances/balances.module';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    DatabaseModule,
    BalancesModule,
  ],
})
export class AccountsModule {}
