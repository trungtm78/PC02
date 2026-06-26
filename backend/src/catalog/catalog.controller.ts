import { Controller, Get, Param } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogValue } from './catalog.registry';

// Cung cấp options danh mục cho FE (chủ yếu nhóm dynamic; legal FE đã có inline qua generated).
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get(':key/options')
  options(@Param('key') key: string): Promise<CatalogValue[]> {
    return this.catalog.options(key);
  }
}
