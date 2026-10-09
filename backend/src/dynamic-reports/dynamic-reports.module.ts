import { Module } from '@nestjs/common';
import { ClockController } from './clock.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ClockController],
})
export class DynamicReportsModule {}
