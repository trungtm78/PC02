import { ShieldOff } from 'lucide-react';
import { processingFlow as L } from '@/locales/processingFlow.vi';

/**
 * What a screen shows to a person who does not hold the permission to read it (the route answers 403). Plain words and
 * no retry button: nothing has failed and asking again changes nothing.
 */
export function ForbiddenState({ body = L.common.forbidden }: { body?: string }) {
  return (
    <div data-testid="processing-flow-forbidden" role="alert" className="m-4 rounded-lg border border-amber-200 bg-amber-50 p-8 text-center">
      <ShieldOff className="mx-auto mb-3 h-8 w-8 text-amber-700" aria-hidden="true" />
      <h1 className="text-lg font-semibold text-amber-900">{L.common.forbiddenTitle}</h1>
      <p className="mt-1 text-sm text-amber-900">{body}</p>
    </div>
  );
}
