import {
  PETITION_LEGACY_SPEC,
  type PetitionFieldPath,
} from '@/features/petitions/legacy-form-binding';
import type { FormAccess } from '@/features/ocr-import/fillPlan';
import type { PetitionFormData } from './types';

/**
 * The form as the scan-intake code sees it: read and write a field by the name the layout gives it.
 *
 * The letter date is one box on screen but three columns underneath: the box reads `ngayVietDonEdtf` (or the verbatim
 * `ngayVietDonChu`), and `petitionDate` is the real date column kept for filtering and printing. A fill that wrote only
 * `petitionDate` left the box empty under a "confirmed" badge, so the date goes to both, as the form itself does when
 * it opens a record that has only the date column.
 */
export const PETITION_OCR_ACCESS: FormAccess<PetitionFormData> = {
  read: (form, field) =>
    field === 'petitionDate'
      ? // Anything in the box counts as the officer's own, even a date typed only in part.
        form.petitionDate || form.ngayVietDonEdtf || form.ngayVietDonChu
      : PETITION_LEGACY_SPEC.read(form, field as PetitionFieldPath),
  write: (form, field, value) => {
    const next = PETITION_LEGACY_SPEC.write(form, field as PetitionFieldPath, value);
    if (field !== 'petitionDate') return next;
    return { ...next, ngayVietDonEdtf: String(value ?? ''), ngayVietDonChu: '' };
  },
};
