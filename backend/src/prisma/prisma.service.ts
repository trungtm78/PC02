import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { OMIT_COT_BONG } from '../common/tim-kiem/cot-bong-an';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    /*
      Perf (X04 benchmark, PR10, dynamic-reports): `pg.Pool` defaults `max`
      to 10 when not set. 50 concurrent writes measured 16% failing with
      "Unable to start a transaction in the given time" — every
      `$transaction()` call needs its own held connection for the
      transaction's duration, so a burst bigger than the pool starves.
      Raising it to 20 only reduced the failure rate (6-18% across 4
      re-measured runs, confirmed via server logs as the same Prisma P2028
      "unable to start a transaction" error) — 20 connections still queues
      more than half of a 50-concurrent burst, and Prisma's default
      `$transaction` `maxWait` (2s) isn't enough slack for that queue depth.
      50 is the module's own explicit acceptance target (spec §6.1 PR10:
      "thử 50 người lưu đồng thời"), so size the pool to match it exactly
      rather than guess at a smaller number — this backend runs as a single
      instance (no horizontal scaling configured), and Postgres 18's
      `max_connections` default (100, confirmed via `SHOW max_connections`
      on both dev and the documented prod setup) leaves comfortable
      headroom above 50 for migrations, CLI scripts and psql sessions.
      `DB_POOL_MAX` lets ops tune this per environment without a code
      change.
    */
    const adapter = new PrismaPg({
      connectionString: process.env['DATABASE_URL'],
      max: Number(process.env['DB_POOL_MAX']) || 50,
    });
    /*
      `omit` TOÀN CỤC cho cột bóng tìm kiếm — xem `cot-bong-an.ts`.

      Prisma trả mọi cột vô hướng khi lời gọi không khai `select`, và đường xem chi tiết dùng
      `include` chứ không `select`: cột ghép `tim_kiem_bd` đi thẳng ra API ở mọi thực thể. Chặn ở
      một chỗ thay vì thêm `select` ở từng lời gọi — n chỗ là n cơ hội quên, và cái quên ấy im lặng.

      `omit` chỉ đổi phần CHỌN, không đổi phần LỌC: mọi điều kiện `where` trên cột bóng vẫn chạy
      như cũ, và CLI nạp cột bóng đi bằng SQL thô nên không bị ảnh hưởng.
    */
    super({ adapter, omit: OMIT_COT_BONG });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
