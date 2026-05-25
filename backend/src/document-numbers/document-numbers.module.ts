import { Module } from '@nestjs/common';
import { DocumentNumbersService } from './document-numbers.service';
import { DocumentNumbersController } from './document-numbers.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [DocumentNumbersService],
  controllers: [DocumentNumbersController],
  exports: [DocumentNumbersService],
})
export class DocumentNumbersModule {}
