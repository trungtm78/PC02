import { Modal } from '@/components/shared/Modal';
import { wardAssignmentAlerts as t } from '@/locales/wardAssignmentAlerts.vi';
import type { SubjectMatch } from '../api/alerts';
import { SubjectMatches } from './SubjectMatches';

/**
 * "Rà soát đối tượng" before PC02 decides, made like the petition's "Rà soát trùng": opened by itself when a request
 * waiting for review has subjects like people of other records, and again when an approval is refused for an
 * unconcluded match of the same identity number. Each line: level, what is the same, the other record (opened read
 * only), and "the same person" / "not the same".
 */
export function SubjectReviewDialog({
  assignmentId,
  canConclude,
  onClose,
  onLoaded,
}: {
  assignmentId: string;
  canConclude: boolean;
  onClose: () => void;
  onLoaded?: (matches: SubjectMatch[]) => void;
}) {
  const R = t.review;
  return (
    <Modal
      open
      onClose={onClose}
      title={R.title}
      maxWidth="max-w-4xl"
      footer={
        <div className="flex justify-end">
          <button type="button" data-testid="ward-subject-review-close" className="rounded border px-3 py-1.5 text-sm hover:bg-slate-50" onClick={onClose}>
            {R.close}
          </button>
        </div>
      }
    >
      <div data-testid="ward-subject-review" className="space-y-3">
        <p className="text-sm text-slate-700">{R.intro}</p>
        <SubjectMatches assignmentId={assignmentId} canConclude={canConclude} onLoaded={onLoaded} />
        <p className="text-xs text-slate-500">{R.incidentNote}</p>
      </div>
    </Modal>
  );
}

export default SubjectReviewDialog;
