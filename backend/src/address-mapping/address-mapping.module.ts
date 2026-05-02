import { Module } from '@nestjs/common';
import { AddressMappingController } from './address-mapping.controller';
import { AddressMappingService } from './address-mapping.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AddressMappingController],
  providers: [AddressMappingService],
  exports: [AddressMappingService],
})
export class AddressMappingModule {}
