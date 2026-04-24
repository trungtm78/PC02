import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertAbbreviationDto } from './dto/upsert-abbreviation.dto';
import { CopyAbbreviationsDto } from './dto/copy-abbreviations.dto';

const SHORTCUT_REGEX = /^[a-zA-Z0-9_-]{1,20}$/;

@Injectable()
export class AbbreviationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.userAbbreviation.findMany({
      where: { userId },
      orderBy: { shortcut: 'asc' },
    });
  }

  async upsert(userId: string, shortcut: string, dto: UpsertAbbreviationDto) {
    if (!SHORTCUT_REGEX.test(shortcut)) {
      throw new BadRequestException(
        'Phím tắt không hợp lệ — chỉ được dùng [a-zA-Z0-9_-], tối đa 20 ký tự',
      );
    }
    return this.prisma.userAbbreviation.upsert({
      where: { userId_shortcut: { userId, shortcut } },
      create: { userId, shortcut, expansion: dto.expansion },
      update: { expansion: dto.expansion },
    });
  }

  async remove(userId: string, shortcut: string) {
    if (!SHORTCUT_REGEX.test(shortcut)) {
      throw new BadRequestException('Phím tắt không hợp lệ');
    }
    const existing = await this.prisma.userAbbreviation.findUnique({
      where: { userId_shortcut: { userId, shortcut } },
    });
    if (!existing) {
      throw new NotFoundException(`Phím tắt '${shortcut}' không tồn tại`);
    }
    return this.prisma.userAbbreviation.delete({
      where: { userId_shortcut: { userId, shortcut } },
    });
  }

  async copyFrom(userId: string, dto: CopyAbbreviationsDto) {
    const { sourceUserId, replace = false } = dto;

    if (sourceUserId === userId) {
      throw new ConflictException('Không thể sao chép từ chính mình');
    }

    const sourceUser = await this.prisma.user.findUnique({ where: { id: sourceUserId } });
    if (!sourceUser || !sourceUser.isActive) {
      throw new NotFoundException('Người dùng nguồn không tồn tại hoặc đã bị khoá');
    }

    const sourceAbbrevs = await this.prisma.userAbbreviation.findMany({
      where: { userId: sourceUserId },
    });

    const newRecords = sourceAbbrevs.map(({ shortcut, expansion }) => ({
      userId,
      shortcut,
      expansion,
    }));

    if (replace) {
      // FINDING-3: wrap in transaction to prevent data loss if createMany fails
      await this.prisma.$transaction([
        this.prisma.userAbbreviation.deleteMany({ where: { userId } }),
        this.prisma.userAbbreviation.createMany({ data: newRecords, skipDuplicates: true }),
      ]);
    } else {
      // merge: insert only shortcuts not already owned by target user
      await this.prisma.userAbbreviation.createMany({ data: newRecords, skipDuplicates: true });
    }

    return { copied: sourceAbbrevs.length };
  }

  async listUsers(excludeUserId: string) {
    return this.prisma.user.findMany({
      where: { isActive: true, id: { not: excludeUserId } },
      select: { id: true, email: true, firstName: true, lastName: true },
      orderBy: { email: 'asc' },
      take: 200,
    });
  }
}
