import { Module } from '@nestjs/common';
import { PushService } from './push.service';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DevicesController],
  providers: [PushService, DevicesService],
  exports: [PushService],
})
export class PushModule {}
