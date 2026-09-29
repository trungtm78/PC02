import type { CaseFormData } from './types';

interface CaseDefaults {
  today: string;
  userId?: string | null;
  primaryTeamName?: string | null;
  primaryTeamId?: string | null;
}

export function applyCaseFormDefaults(form: CaseFormData, defaults: CaseDefaults): CaseFormData {
  return {
    ...form,
    receiveDate: form.receiveDate || defaults.today,
    handler: form.handler || defaults.userId || '',
    supervisingUnit: form.supervisingUnit || (
      form.caseProvenance === 'UY_THAC_DIEU_TRA' ? '' : defaults.primaryTeamName || ''
    ),
    assignedTeamId: form.assignedTeamId || defaults.primaryTeamId || '',
  };
}
