import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertShortcutDto } from './dto/upsert-shortcut.dto';
import { SwapShortcutsDto } from './dto/swap-shortcuts.dto';
import { ACTION_REGEX, BINDING_REGEX } from './binding-regex.const';

@Injectable()
export class UserShortcutsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.userShortcut.findMany({
      where: { userId },
      orderBy: { action: 'asc' },
    });
  }

  async upsert(userId: string, action: string, dto: UpsertShortcutDto) {
    if (!ACTION_REGEX.test(action)) {
      throw new BadRequestException('Hành động không hợp lệ');
    }
    if (!BINDING_REGEX.test(dto.binding)) {
      throw new BadRequestException('Phím tắt không hợp lệ');
    }

    try {
      return await this.prisma.userShortcut.upsert({
        where: { userId_action: { userId, action } },
        create: { userId, action, binding: dto.binding },
        update: { binding: dto.binding },
      });
    } catch (err) {
      // P2002: unique constraint violation. With @@unique([userId, binding]), this fires when
      // another action for same user already owns this binding.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const existing = await this.prisma.userShortcut.findFirst({
          where: { userId, binding: dto.binding, NOT: { action } },
        });
        throw new ConflictException(
          existing
            ? `Phím tắt '${dto.binding}' đang dùng cho hành động khác: ${existing.action}`
            : `Phím tắt '${dto.binding}' đã được dùng`,
        );
      }
      throw err;
    }
  }

  async remove(userId: string, action: string) {
    if (!ACTION_REGEX.test(action)) {
      throw new BadRequestException('Hành động không hợp lệ');
    }
    const existing = await this.prisma.userShortcut.findUnique({
      where: { userId_action: { userId, action } },
    });
    if (!existing) {
      throw new NotFoundException(
        `Hành động '${action}' chưa có override — đã ở giá trị mặc định`,
      );
    }
    return this.prisma.userShortcut.delete({
      where: { userId_action: { userId, action } },
    });
  }

  async resetAll(userId: string) {
    const result = await this.prisma.userShortcut.deleteMany({
      where: { userId },
    });
    return { deleted: result.count };
  }

  /**
   * Atomically swap bindings between two actions.
   *
   * Transaction shape:
   *   1. Read both rows (A, B). If either row missing, treat its current binding as
   *      "no override" — but swap requires both sides to have a binding to swap. If
   *      one side has no override, FE should call upsert directly instead.
   *   2. Park A's binding to a temporary unique sentinel (avoid violating
   *      @@unique([userId, binding]) when we set B's binding).
   *   3. Update B's binding → A's old binding.
   *   4. Update A's binding → B's old binding.
   * All in $transaction for atomicity.
   */
  async swap(userId: string, dto: SwapShortcutsDto) {
    const { fromAction, toAction } = dto;
    if (fromAction === toAction) {
      throw new BadRequestException('Hai hành động phải khác nhau');
    }
    if (!ACTION_REGEX.test(fromAction) || !ACTION_REGEX.test(toAction)) {
      throw new BadRequestException('Hành động không hợp lệ');
    }

    return this.prisma.$transaction(async (tx) => {
      const fromRow = await tx.userShortcut.findUnique({
        where: { userId_action: { userId, action: fromAction } },
      });
      const toRow = await tx.userShortcut.findUnique({
        where: { userId_action: { userId, action: toAction } },
      });
      if (!fromRow || !toRow) {
        throw new NotFoundException(
          'Cần override cho cả hai hành động trước khi swap. Dùng upsert nếu một bên đang ở mặc định.',
        );
      }
      const tempBinding = `__swap_${userId}_${Date.now()}__`;
      // Park fromRow to temp to free its binding
      await tx.userShortcut.update({
        where: { userId_action: { userId, action: fromAction } },
        data: { binding: tempBinding },
      });
      // Move toRow → fromRow's old binding
      await tx.userShortcut.update({
        where: { userId_action: { userId, action: toAction } },
        data: { binding: fromRow.binding },
      });
      // Move fromRow → toRow's old binding
      await tx.userShortcut.update({
        where: { userId_action: { userId, action: fromAction } },
        data: { binding: toRow.binding },
      });
      return {
        success: true,
        from: { action: fromAction, binding: toRow.binding },
        to: { action: toAction, binding: fromRow.binding },
      };
    });
  }
}
