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
    const adapter = new PrismaPg({
      connectionString: process.env['DATABASE_URL'],
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
