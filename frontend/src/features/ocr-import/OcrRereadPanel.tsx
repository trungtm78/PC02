import type { Dispatch, SetStateAction } from 'react';
import type { FormAccess } from './fillPlan';
import type { OcrEntityName } from './ocrApi';
import { RereadSection } from './RereadSection';
import { useOcrAvailability } from './useOcrAvailability';
import { useOcrReread } from './useOcrReread';

export interface OcrRereadPanelProps<TForm> {
  entity: OcrEntityName;
  /** The saved record whose attached scans are read again. */
  recordId: string;
  access: FormAccess<TForm>;
  form: TForm;
  setForm: Dispatch<SetStateAction<TForm>>;
  toFormPath?: (serverField: string) => string;
  captionOf: (field: string) => string;
  /** False when the form is view-only or not an edit screen. */
  visible: boolean;
}

/** One element for an edit screen: reads the record's scans again and offers the differences, field by field. */
export function OcrRereadPanel<TForm>({
  entity,
  recordId,
  access,
  form,
  setForm,
  toFormPath,
  captionOf,
  visible,
}: OcrRereadPanelProps<TForm>) {
  const available = useOcrAvailability() && visible;
  const reread = useOcrReread({ entity, recordId, access, form, setForm, toFormPath });
  return <RereadSection available={available} reread={reread} captionOf={captionOf} />;
}
