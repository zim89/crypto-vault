import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { GrpcExceptionFilter } from '@app/common';
import { IDENTITY_PACKAGE_NAME } from '@app/contracts';
import { ENV_KEYS, IDENTITY_GRPC, IDENTITY_PROTO_PATH } from './config';
import { IdentityModule } from './identity.module';

async function bootstrap() {
  const logger = new Logger('IdentityBootstrap');
  const grpcUrl = process.env[ENV_KEYS.identityGrpcUrl] ?? IDENTITY_GRPC.defaultUrl;

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(IdentityModule, {
    transport: Transport.GRPC,
    options: {
      package: IDENTITY_PACKAGE_NAME,
      protoPath: IDENTITY_PROTO_PATH,
      url: grpcUrl,
    },
  });

  app.useGlobalFilters(new GrpcExceptionFilter());
  app.enableShutdownHooks();

  await app.listen();
  logger.log(`🚀 Identity gRPC Microservice is running on ${grpcUrl}`);
}

void bootstrap();
