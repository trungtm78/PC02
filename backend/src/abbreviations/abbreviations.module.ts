import { Module } from '@nestjs/common';
import { AbbreviationsController } from './abbreviations.controller';
import { AbbreviationsService } from './abbreviations.service';

@Module({
  controllers: [AbbreviationsController],
  providers: [AbbreviationsService],
})
export class AbbreviationsModule {}
