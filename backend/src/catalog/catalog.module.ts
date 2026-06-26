import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';

// PrismaModule là @Global → không cần import. Controller thêm ở Task 3.
@Module({
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
