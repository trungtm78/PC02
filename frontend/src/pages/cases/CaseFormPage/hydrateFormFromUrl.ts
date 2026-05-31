/**
 * PR 3 v0.38.2.0 + Hotfix #112 — URL param hydration helper.
 *
 * Entry path 2 (button "Khởi tố" trên IncidentDetailPage) + entry path 3
 * (button trên IncidentFormPage section Kết quả) navigate:
 *   /cases/new?linkedIncidentId=X&caseProvenance=FROM_INCIDENT
 *           &expectedIncidentUpdatedAt=<ISO>
 *
 * CaseFormPage useEffect call helper này để hydrate formData từ URL params.
 *
 * HOTFIX #112: expectedIncidentUpdatedAt — backend create-case.dto.ts:218
 * @ValidateIf require khi caseProvenance=FROM_INCIDENT. Thiếu → 400.
 *
 * Extracted as pure function để testable (urlHydration.test.ts).
 */
import type { CaseFormData } from './types';

export function hydrateFormFromUrl(
  searchParams: URLSearchParams,
): Partial<CaseFormData> {
  const linkedIncidentId = searchParams.get('linkedIncidentId');
  const urlCaseProvenance = searchParams.get('caseProvenance');

  // UTDT entry path: caseProvenance standalone (no linkedIncidentId)
  if (urlCaseProvenance && !linkedIncidentId) {
    const updates: Partial<CaseFormData> = { caseProvenance: urlCaseProvenance };
    // Bug 2 fix: khi vào UTDT, pre-fill utdt_loaiUyThac = 'UY_THAC_DIEU_TRA' để
    // dropdown "Loại ủy thác" không trống — user tạo mới thường chọn đúng loại này.
    if (urlCaseProvenance === 'UY_THAC_DIEU_TRA') {
      updates.utdt_loaiUyThac = 'UY_THAC_DIEU_TRA';
    }
    return updates;
  }

  // Optimistic lock token một mình không có ý nghĩa — cần kèm link
  if (!linkedIncidentId || !urlCaseProvenance) {
    return {};
  }

  const urlExpectedIncidentUpdatedAt = searchParams.get(
    'expectedIncidentUpdatedAt',
  );

  const updates: Partial<CaseFormData> = {
    linkedIncidentId,
    caseProvenance: urlCaseProvenance,
  };

  if (urlExpectedIncidentUpdatedAt) {
    updates.expectedIncidentUpdatedAt = urlExpectedIncidentUpdatedAt;
  }

  return updates;
}
