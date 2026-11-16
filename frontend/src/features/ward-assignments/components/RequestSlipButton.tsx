import { useEffect, useState } from 'react';
import { Download, FileSignature, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/api-errors';
import { wardAssignmentDocs as t, wardDocsErrorText } from '@/locales/wardAssignmentDocs.vi';
import { saveDownloadedFile, wardDocsApi, type SlipSigners, type WardSlipDecision } from '../api/docs';

export interface RequestSlipButtonProps {
  assignmentId: string;
  decisionId: string;
  /** The number of the slip already issued for this decision, or null. */
  slipNumber: string | null;
  /** PC02 with the review reach: issue and reissue. Everybody who may read the request downloads an issued slip. */
  canIssue: boolean;
  /** Told the decision after an issue or a reissue (the parent refreshes the request). */
  onChanged?: (decision: WardSlipDecision) => void;
}

function errorText(error: unknown): string {
  const e = extractApiError(error);
  return wardDocsErrorText(e.code, e.status);
}

const SIGNER_KEYS = ['canBoThamDinh', 'chiHuyDoi', 'lanhDaoPhong'] as const;

/**
 * "Phiếu yêu cầu" of one decision: issue it once (the next number of the series, or a number written by hand such as
 * 1949A), download the stored file (a reprint is the file issued, never a new render), reissue it with a reason.
 */
export function RequestSlipButton({ assignmentId, decisionId, slipNumber, canIssue, onChanged }: RequestSlipButtonProps) {
  const [number, setNumber] = useState<string | null>(slipNumber);
  const [mode, setMode] = useState<'idle' | 'issue' | 'reissue'>('idle');
  const [manual, setManual] = useState('');
  const [reason, setReason] = useState('');
  const [signers, setSigners] = useState<SlipSigners>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => setNumber(slipNumber), [slipNumber]);

  const filledSigners = (): SlipSigners | undefined => {
    const out: SlipSigners = {};
    for (const key of SIGNER_KEYS) {
      const v = signers[key]?.trim();
      if (v) out[key] = v;
    }
    return Object.keys(out).length ? out : undefined;
  };

  const run = async (action: () => Promise<WardSlipDecision>, done: (n: string) => string) => {
    setBusy(true);
    setMessage(null);
    try {
      const decision = await action();
      setNumber(decision.slipNumber);
      setMode('idle');
      setManual('');
      setReason('');
      setMessage({ kind: 'ok', text: done(decision.slipNumber ?? '') });
      onChanged?.(decision);
    } catch (error) {
      setMessage({ kind: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const issue = () =>
    run(() => wardDocsApi.issueSlip(assignmentId, decisionId, { ...(manual.trim() ? { slipNumber: manual.trim() } : {}), ...(filledSigners() ? { signers: filledSigners() } : {}) }), t.slip.issued);

  const reissue = () => run(() => wardDocsApi.reissueSlip(assignmentId, decisionId, { reason: reason.trim(), ...(filledSigners() ? { signers: filledSigners() } : {}) }), t.slip.reissued);

  const download = async () => {
    setBusy(true);
    setMessage(null);
    try {
      saveDownloadedFile(await wardDocsApi.downloadSlip(assignmentId, decisionId));
    } catch (error) {
      setMessage({ kind: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const signerInputs = (
    <fieldset className="space-y-2">
      <p className="text-xs text-slate-500">{t.slip.signers.hint}</p>
      {SIGNER_KEYS.map((key) => (
        <label key={key} className="block text-xs text-slate-600">
          {t.slip.signers[key]}
          <input
            className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm"
            maxLength={120}
            value={signers[key] ?? ''}
            onChange={(e) => setSigners((s) => ({ ...s, [key]: e.target.value }))}
          />
        </label>
      ))}
    </fieldset>
  );

  return (
    <div className="space-y-2" data-testid="ward-request-slip">
      <div className="flex flex-wrap items-center gap-2">
        {number ? (
          <>
            <span className="text-sm font-medium text-slate-800">{t.slip.number(number)}</span>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void download()}>
              <Download className="mr-1 h-4 w-4" aria-hidden />
              {t.slip.download}
            </Button>
            {canIssue && mode === 'idle' && (
              <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setMode('reissue')}>
                <RefreshCw className="mr-1 h-4 w-4" aria-hidden />
                {t.slip.reissue}
              </Button>
            )}
          </>
        ) : canIssue ? (
          mode === 'idle' && (
            <Button type="button" size="sm" disabled={busy} onClick={() => setMode('issue')}>
              <FileSignature className="mr-1 h-4 w-4" aria-hidden />
              {t.slip.issue}
            </Button>
          )
        ) : (
          <span className="text-sm text-slate-500">{t.slip.notIssued}</span>
        )}
      </div>

      {mode === 'issue' && !number && (
        <form
          className="space-y-3 rounded border border-slate-200 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void issue();
          }}
        >
          <label className="block text-xs text-slate-600">
            {t.slip.manualNumber}
            <input
              className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder={t.slip.manualNumberPlaceholder}
              maxLength={30}
              value={manual}
              onChange={(e) => setManual(e.target.value)}
            />
          </label>
          {signerInputs}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setMode('idle')}>
              {t.slip.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? t.slip.issuing : t.slip.confirmIssue}
            </Button>
          </div>
        </form>
      )}

      {mode === 'reissue' && number && (
        <form
          className="space-y-3 rounded border border-slate-200 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void reissue();
          }}
        >
          <label className="block text-xs text-slate-600">
            {t.slip.reissueReason}
            <textarea
              className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 text-sm"
              rows={2}
              maxLength={500}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {signerInputs}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setMode('idle')}>
              {t.slip.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={busy || !reason.trim()}>
              {t.slip.reissueConfirm}
            </Button>
          </div>
        </form>
      )}

      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind === 'error' ? 'text-sm text-red-600' : 'text-sm text-green-700'}>
          {message.text}
        </p>
      )}
    </div>
  );
}

export default RequestSlipButton;
