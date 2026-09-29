import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
  PermissionRule,
} from '../decorators/permissions.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<
      PermissionRule[]
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    const alternativePermissions = this.reflector.getAllAndOverride<
      PermissionRule[]
    >(ANY_PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    // No permissions required → allow
    if (
      (!requiredPermissions || requiredPermissions.length === 0) &&
      (!alternativePermissions || alternativePermissions.length === 0)
    ) {
      return true;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const request = context.switchToHttp().getRequest();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('No authenticated user');
    }

    // Fetch role permissions from DB
    const rolePerms = await this.prisma.rolePermission.findMany({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      where: { roleId: user.roleId },
      include: { permission: true },
    });

    const userPermissions = rolePerms.map((rp) => ({
      action: rp.permission.action,
      subject: rp.permission.subject,
    }));

    const hasAll = (requiredPermissions ?? []).every((required) =>
      userPermissions.some(
        (p) => p.action === required.action && p.subject === required.subject,
      ),
    );
    const hasAlternative =
      !alternativePermissions?.length ||
      alternativePermissions.some((required) =>
        userPermissions.some(
          (permission) =>
            permission.action === required.action &&
            permission.subject === required.subject,
        ),
      );

    if (!hasAll || !hasAlternative) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
