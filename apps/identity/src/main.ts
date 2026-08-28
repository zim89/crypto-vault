import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import { join } from 'path';
import { IdentityModule } from './identity.module';
import { GrpcExceptionFilter } from '@app/common';
import { protobufPackage } from '@app/contracts';

async function bootstrap() {
  const logger = new Logger('IdentityBootstrap');
  const grpcUrl = process.env.IDENTITY_GRPC_URL || '0.0.0.0:50051';
  const protoPath = join(process.cwd(), 'libs/contracts/proto/identity.proto');

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(IdentityModule, {
    transport: Transport.GRPC,
    options: {
      package: protobufPackage,
      protoPath,
      url: grpcUrl,
    },
  });

  app.useGlobalFilters(new GrpcExceptionFilter());
  app.enableShutdownHooks();

  await app.listen();
  logger.log(`🚀 Identity gRPC Microservice is running on ${grpcUrl}`);
}

void bootstrap();
