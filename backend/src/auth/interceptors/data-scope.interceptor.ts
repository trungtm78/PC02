import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { UnitScopeService } from '../services/unit-scope.service';

@Injectable()
export class DataScopeInterceptor implements NestInterceptor {
  constructor(private readonly unitScopeService: UnitScopeService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user?.id && user?.role) {
      const scope = await this.unitScopeService.resolveScope(
        user.id,
        user.role,
      );
      request.dataScope = scope;
    } else if (user?.id && !user?.role) {
      // JWT without role claim — deny-all scope rather than defaulting to admin
      request.dataScope = { teamIds: [], userIds: [], writableTeamIds: [] };
    }

    return next.handle();
  }
}
