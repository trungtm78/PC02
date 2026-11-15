import { PowerOff } from 'lucide-react';
import { processingFlow as L } from '@/locales/processingFlow.vi';

/**
 * What a screen shows when the backend switch `processing_flow` is off (the routes answer 404). Plain words, no error
 * banner: nothing has failed, the feature simply is not turned on.
 */
export function FeatureOffState() {
  return (
    <div data-testid="processing-flow-disabled" className="m-4 rounded-lg border border-slate-200 bg-white p-8 text-center">
      <PowerOff className="mx-auto mb-3 h-8 w-8 text-slate-400" aria-hidden="true" />
      <h1 className="text-lg font-semibold text-slate-800">{L.disabled.title}</h1>
      <p className="mt-1 text-sm text-slate-600">{L.disabled.body}</p>
    </div>
  );
}
