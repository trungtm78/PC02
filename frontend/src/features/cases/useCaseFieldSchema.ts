import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { PublishedCaseFieldSchema } from './CaseCustomFields';
export function useCaseFieldSchema(caseId?: string, refreshKey = 0) {
  const endpoint = caseId ? `/cases/${encodeURIComponent(caseId)}/governance/field-schema` : '/cases/governance/field-schema';
  const [result, setResult] = useState<{ endpoint: string; schema: PublishedCaseFieldSchema | null; error: string; loading: boolean }>({ endpoint, schema: null, error: '', loading: true });
  useEffect(() => {
    let active = true;
    api.get<{ data: PublishedCaseFieldSchema | null }>(endpoint).then(response => {
      const schema = response.data?.data;
      if (schema !== null && (!schema || schema.status !== 'PUBLISHED' || !Array.isArray(schema.definition?.fields) || !schema.values || typeof schema.values !== 'object' || Array.isArray(schema.values) || (schema.definition.fieldPolicies !== undefined && (!Array.isArray(schema.definition.fieldPolicies) || schema.definition.fieldPolicies.some(policy => typeof policy.key !== 'string' || typeof policy.readable !== 'boolean' || typeof policy.writable !== 'boolean'))))) throw new Error('Không xác minh được chính sách thông tin của hồ sơ.');
      if (active) setResult({ endpoint, schema: schema?.status === 'PUBLISHED' && Array.isArray(schema.definition?.fields) ? schema : null, error: '', loading: false });
    }).catch(() => {
      if (active) setResult({ endpoint, schema: null, error: 'Không tải được thông tin bổ sung. Vui lòng mở lại hồ sơ trước khi chỉnh sửa các trường này.', loading: false });
    });
    return () => { active = false; };
  }, [endpoint, refreshKey]);
  return result.endpoint === endpoint ? result : { endpoint, schema: null, error: '', loading: true };
}
