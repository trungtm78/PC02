import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class DispatchGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    return user?.canDispatch === true || user?.role === 'ADMIN';
  }
}
