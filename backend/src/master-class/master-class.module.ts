import { Module } from '@nestjs/common';
import { MasterClassController } from './master-class.controller';
import { MasterClassService } from './master-class.service';

@Module({
  controllers: [MasterClassController],
  providers: [MasterClassService],
  exports: [MasterClassService],
})
export class MasterClassModule {}
