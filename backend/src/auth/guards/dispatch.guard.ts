import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ROLE_NAMES } from '../../common/constants/role.constants';

@Injectable()
export class DispatchGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    return user?.canDispatch === true || user?.role === ROLE_NAMES.ADMIN;
  }
}
