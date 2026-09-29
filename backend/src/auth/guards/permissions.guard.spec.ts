import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { PermissionsGuard } from './permissions.guard';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
} from '../decorators/permissions.decorator';

describe('PermissionsGuard — quyền thay thế', () => {
  const executionContext = {
    getHandler: () => 'handler',
    getClass: () => 'controller',
    switchToHttp: () => ({
      getRequest: () => ({ user: { roleId: 'role-1' } }),
    }),
  } as unknown as ExecutionContext;

  function makeGuard(granted: Array<{ action: string; subject: string }>) {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => {
        if (key === PERMISSIONS_KEY) return [];
        if (key === ANY_PERMISSIONS_KEY) {
          return [
            { action: 'write', subject: 'Petition' },
            { action: 'write', subject: 'Case' },
          ];
        }
        return undefined;
      }),
    } as unknown as Reflector;
    const prisma = {
      rolePermission: {
        findMany: jest
          .fn()
          .mockResolvedValue(granted.map((permission) => ({ permission }))),
      },
    } as unknown as PrismaService;
    return new PermissionsGuard(reflector, prisma);
  }

  it('chấp nhận khi có một trong các quyền thay thế', async () => {
    await expect(
      makeGuard([{ action: 'write', subject: 'Case' }]).canActivate(
        executionContext,
      ),
    ).resolves.toBe(true);
  });

  it('từ chối khi không có quyền thay thế nào', async () => {
    await expect(
      makeGuard([]).canActivate(executionContext),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
