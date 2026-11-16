/**
 * "In phiếu yêu cầu" — the one dialog the request slip of a decision is printed from: the form's action bar and F4,
 * the row of the list, and by itself right after PC02 returns or approves.
 *
 * Not issued yet (PC02 with the review reach): the number (empty = the next of the series) and the three signers,
 * filled in with the names the server would use, what the slip would print empty, then ONE button that issues the
 * slip and saves the file. Issued: the button saves the stored file; "Phát hành lại" asks for a reason.
 * The slip stays what the server made of it: one number and one stored file per decision.
 */
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Loader2, Printer, RefreshCw } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT_BASE, LABEL_BASE, LABEL_REQUIRED_MARKER, TEXTAREA_BASE } from '@/constants/styles';
import { extractApiError } from '@/lib/api-errors';
import { wardAssignmentDocs as t, wardDocsErrorText } from '@/locales/wardAssignmentDocs.vi';
import { saveDownloadedFile, wardDocsApi, type SlipSigners, type WardSlipDecision } from '../api/docs';

export interface RequestSlipDialogProps {
  assignmentId: string;
  decision: { id: string; kind: 'RETURN' | 'APPROVE'; slipNumber: string | null };
  /** PC02 with the review reach: issue and reissue. Whoever reads the request saves an issued slip. */
  canIssue: boolean;
  onClose: () => void;
  /** Told after an issue or a reissue (the parent reads the request again). */
  onChanged?: (decision: WardSlipDecision) => void;
}

const SIGNER_KEYS = ['canBoThamDinh', 'chiHuyDoi', 'lanhDaoPhong'] as const;

function errorText(error: unknown): string {
  const e = extractApiError(error);
  return wardDocsErrorText(e.code, e.status);
}

export function RequestSlipDialog({ assignmentId, decision, canIssue, onClose, onChanged }: RequestSlipDialogProps) {
  const [number, setNumber] = useState<string | null>(decision.slipNumber);
  const [reissuing, setReissuing] = useState(false);
  const [manual, setManual] = useState('');
  const [reason, setReason] = useState('');
  const [signers, setSigners] = useState<SlipSigners>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const defaults = useQuery({
    queryKey: ['ward-assignments', 'slip-defaults', assignmentId, decision.id],
    queryFn: () => wardDocsApi.slipDefaults(assignmentId, decision.id),
    enabled: canIssue,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });

  // The names the server would use, shown once: what the person types afterwards is theirs.
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    if (!defaults.data || filled) return;
    setFilled(true);
    setSigners({ ...defaults.data.signers });
    if (defaults.data.slipNumber) setNumber(defaults.data.slipNumber);
  }, [defaults.data, filled]);

  /** Every name as it stands when the defaults were shown (an emptied field is an empty line on the slip); else only what was typed. */
  const signersToSend = (): SlipSigners | undefined => {
    const out: SlipSigners = {};
    for (const key of SIGNER_KEYS) {
      const v = signers[key]?.trim() ?? '';
      if (v || filled) out[key] = v;
    }
    return Object.keys(out).length ? out : undefined;
  };

  const save = async (): Promise<boolean> => {
    try {
      saveDownloadedFile(await wardDocsApi.downloadSlip(assignmentId, decision.id));
      return true;
    } catch (error) {
      setMessage({ kind: 'error', text: errorText(error) });
      return false;
    }
  };

  /** Issue (or reissue) and save the file in one go: the person asked to print, not to "issue then fetch". */
  const run = async (action: () => Promise<WardSlipDecision>) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const done = await action();
      setNumber(done.slipNumber);
      setReissuing(false);
      setManual('');
      setReason('');
      onChanged?.(done);
      const n = done.slipNumber ?? '';
      try {
        saveDownloadedFile(await wardDocsApi.downloadSlip(assignmentId, decision.id));
        setMessage({ kind: 'ok', text: t.slip.printed(n) });
      } catch {
        // The slip exists: saying "failed" would invite a second issue. Say what happened and how to get the file.
        setMessage({ kind: 'error', text: t.slip.printedNotSaved(n) });
      }
    } catch (error) {
      setMessage({ kind: 'error', text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const issue = () =>
    run(() => {
      const s = signersToSend();
      return wardDocsApi.issueSlip(assignmentId, decision.id, { ...(manual.trim() ? { slipNumber: manual.trim() } : {}), ...(s ? { signers: s } : {}) });
    });

  const reissue = () =>
    run(() => {
      const s = signersToSend();
      return wardDocsApi.reissueSlip(assignmentId, decision.id, { reason: reason.trim(), ...(s ? { signers: s } : {}) });
    });

  const download = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    await save();
    setBusy(false);
  };

  const info = defaults.data;
  const blocked = canIssue && !!info && (!info.templateReady || info.revoked);
  const issuing = !number && canIssue;

  const signerInputs = (
    <fieldset className="space-y-2">
      <legend className={LABEL_BASE}>{t.slip.signersTitle}</legend>
      <p className="text-xs text-slate-500">{filled ? t.slip.signers.prefilled : t.slip.signers.hint}</p>
      {SIGNER_KEYS.map((key) => (
        <label key={key} className="block text-sm text-slate-700">
          {t.slip.signers[key]}
          <input data-testid={`ward-slip-signer-${key}`} className={`${INPUT_BASE} mt-1`} maxLength={120} value={signers[key] ?? ''} onChange={(e) => setSigners((s) => ({ ...s, [key]: e.target.value }))} />
        </label>
      ))}
    </fieldset>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={t.slip.dialogTitle}
      maxWidth="max-w-xl"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" data-testid="ward-slip-close" className={BTN_SECONDARY} onClick={onClose}>
            {t.slip.close}
          </button>
          {number && canIssue && !reissuing && !info?.revoked && (
            <button type="button" data-testid="ward-slip-reissue" className={`${BTN_SECONDARY} flex items-center gap-2`} disabled={busy} onClick={() => setReissuing(true)}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {t.slip.reissue}
            </button>
          )}
          {number && reissuing && (
            <button type="button" data-testid="ward-slip-reissue-confirm" className={BTN_PRIMARY} disabled={busy || !reason.trim() || blocked} onClick={() => void reissue()}>
              {busy ? t.slip.printing : t.slip.reissueConfirm}
            </button>
          )}
          {number && !reissuing && (
            <button type="button" data-testid="ward-slip-download" className={`${BTN_PRIMARY} flex items-center gap-2`} disabled={busy} onClick={() => void download()}>
              <Download className="h-4 w-4" aria-hidden="true" />
              {t.slip.download}
            </button>
          )}
          {issuing && (
            <button type="button" data-testid="ward-slip-print" className={`${BTN_PRIMARY} flex items-center gap-2`} disabled={busy || blocked || defaults.isLoading} onClick={() => void issue()}>
              <Printer className="h-4 w-4" aria-hidden="true" />
              {busy ? t.slip.printing : t.slip.print}
            </button>
          )}
        </div>
      }
    >
      <div data-testid="ward-slip-dialog" className="space-y-4 text-sm">
        <p className="font-medium text-slate-800">
          {t.slip.forDecision[decision.kind]}
          {number && <span data-testid="ward-slip-number"> · {t.slip.number(number)}</span>}
        </p>

        {canIssue && defaults.isLoading && (
          <p className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t.slip.loadingDefaults}
          </p>
        )}
        {canIssue && defaults.isError && (
          <p data-testid="ward-slip-defaults-failed" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
            {t.slip.defaultsFailed}
          </p>
        )}
        {info && !info.templateReady && (
          <p data-testid="ward-slip-template-missing" role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
            {t.slip.templateMissing}
          </p>
        )}
        {info?.revoked && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
            {t.slip.revoked}
          </p>
        )}
        {info && info.missing.length > 0 && !number && (
          <div data-testid="ward-slip-missing" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
            <p>{t.slip.missingTitle}</p>
            <ul className="list-disc pl-5">
              {info.missing.map((m) => (
                <li key={m}>{t.slip.missing[m] ?? m}</li>
              ))}
            </ul>
          </div>
        )}

        {!number && !canIssue && <p className="text-slate-500">{t.slip.notIssued}</p>}

        {issuing && (
          <>
            <label className="block">
              <span className={LABEL_BASE}>{t.slip.manualNumber}</span>
              <input data-testid="ward-slip-manual-number" className={INPUT_BASE} placeholder={t.slip.manualNumberPlaceholder} maxLength={30} value={manual} onChange={(e) => setManual(e.target.value)} />
            </label>
            {signerInputs}
          </>
        )}

        {number && reissuing && (
          <>
            <label className="block">
              <span className={LABEL_BASE}>
                {t.slip.reissueReason}
                <span className={LABEL_REQUIRED_MARKER}> *</span>
              </span>
              <textarea data-testid="ward-slip-reissue-reason" className={TEXTAREA_BASE} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            {signerInputs}
          </>
        )}

        {message && (
          <p data-testid="ward-slip-message" role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind === 'error' ? 'text-red-700' : 'text-green-700'}>
            {message.text}
          </p>
        )}
      </div>
    </Modal>
  );
}
