import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogValue, getCatalogEntry } from './catalog.registry';

// Resolve options/label/validate cho mọi danh mục đồng nhất:
// - legal: lấy trực tiếp từ registry (không chạm DB).
// - dynamic: query bảng Directory theo `source` (type), chỉ isActive, sắp theo order.
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async options(key: string): Promise<CatalogValue[]> {
    const e = getCatalogEntry(key);
    if (e.kind === 'legal') return e.values;
    const type = e.source.split(':')[1];
    const rows = await this.prisma.directory.findMany({
      where: { type, isActive: true },
      orderBy: { order: 'asc' },
    });
    return rows.map((r) => ({ code: r.code, label: r.name }));
  }

  async isValid(key: string, code: string): Promise<boolean> {
    const opts = await this.options(key);
    return opts.some((o) => o.code === code);
  }

  async labelOf(key: string, code: string): Promise<string> {
    const opts = await this.options(key);
    return opts.find((o) => o.code === code)?.label ?? code;
  }
}
