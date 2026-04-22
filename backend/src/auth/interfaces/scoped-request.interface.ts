import type { Request } from 'express';
import type { DataScope } from '../services/unit-scope.service';

export interface ScopedRequest extends Request {
  dataScope?: DataScope | null;
}
