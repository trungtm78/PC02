import { Module } from '@nestjs/common';
import { UserTableLayoutsController } from './user-table-layouts.controller';
import { UserTableLayoutsService } from './user-table-layouts.service';

@Module({
  controllers: [UserTableLayoutsController],
  providers: [UserTableLayoutsService],
  exports: [UserTableLayoutsService],
})
export class UserTableLayoutsModule {}
