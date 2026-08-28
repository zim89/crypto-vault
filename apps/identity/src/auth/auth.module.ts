import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { NonceService } from './nonce.service';
import { ENV_KEYS } from '../config';

@Module({
  imports: [
    UsersModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>(ENV_KEYS.jwtSecret),
        signOptions: {
          expiresIn: configService.get(ENV_KEYS.jwtExpiresIn),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, NonceService],
  exports: [AuthService, TokenService, NonceService],
})
export class AuthModule {}
