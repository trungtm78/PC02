import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
  PermissionRule,
} from '../decorators/permissions.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthzScopeService } from '../../authz/authz-scope.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    @Optional() private readonly authzScope?: AuthzScopeService,
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

    // Permissions by team, when enforced, are what the person holds; otherwise the role's, read as before.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    const enforced = await this.authzScope?.keysFor(user.id);
    const userPermissions = enforced
      ? enforced.map((key) => {
          const at = key.indexOf(':');
          return { action: key.slice(0, at), subject: key.slice(at + 1) };
        })
      : await this.rolePermissions(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
          user.roleId,
        );

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

  private async rolePermissions(roleId: string): Promise<{ action: string; subject: string }[]> {
    const rolePerms = await this.prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    });
    return rolePerms.map((rp) => ({ action: rp.permission.action, subject: rp.permission.subject }));
  }
}
