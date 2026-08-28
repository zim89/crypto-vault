import { NestFactory } from '@nestjs/core';
import { AccountsModule } from './accounts.module';

async function bootstrap() {
  const app = await NestFactory.create(AccountsModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
