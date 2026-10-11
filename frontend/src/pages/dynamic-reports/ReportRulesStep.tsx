/**
 * S36 (PR9 slice 1) — manual validation-rule authoring, wizard step
 * between "teams" and "summary" (spec §6.1 PR9: "soạn quy tắc kiểm tra").
 * Optional step — a report can publish with zero rules, same as it can
 * with zero formulas.
 *
 * Deliberately scoped to MANUAL authoring only. "Gợi ý từ IF" (auto-detect
 * `IF(a=b,TRUE,FALSE)`-shaped formulas in the uploaded template via
 * `suggestValidationRules()`, already written and unit-tested in
 * `backend/src/dynamic-reports/template/suggest-rules.ts` but never wired
 * to any endpoint or UI) is a separate slice — documented here so the next
 * reader doesn't assume it's already covered.
 */
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Plus, Trash2 } from 'lucide-react';
import {
  DYN_REPORT_RULE_OPERATOR_LABEL,
  DYN_REPORT_RULE_SEVERITY_LABEL,
} from '@/shared/enums/status-labels';
import { DynReportRuleOperator, DynReportRuleSeverity } from '@/shared/enums/generated';
import { A11Y_FOCUS_RING } from '@/constants/styles';
import type { ReportRuleConfig } from '@/features/dynamic-reports/types';

interface Props {
  onBack: () => void;
  onNext: (rules: ReportRuleConfig[]) => void;
}

const OPERATORS = Object.values(DynReportRuleOperator);
const SEVERITIES = Object.values(DynReportRuleSeverity);

function emptyDraft(): ReportRuleConfig {
  return {
    name: '',
    leftExpr: '',
    operator: DynReportRuleOperator.EQ,
    rightExpr: '',
    severity: DynReportRuleSeverity.ERROR,
    message: '',
  };
}

export default function ReportRulesStep({ onBack, onNext }: Props) {
  const [rules, setRules] = useState<ReportRuleConfig[]>([]);
  const [draft, setDraft] = useState<ReportRuleConfig>(emptyDraft());

  const canAdd =
    draft.name.trim() &&
    draft.leftExpr.trim() &&
    draft.rightExpr.trim() &&
    draft.message.trim();

  function addRule() {
    if (!canAdd) return;
    setRules((prev) => [...prev, draft]);
    setDraft(emptyDraft());
  }
  function removeRule(index: number) {
    setRules((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div data-testid="rules-step">
      <h2 className="text-sm font-semibold text-slate-700 mb-1">Quy tắc kiểm tra (tuỳ chọn)</h2>
      <p className="text-xs text-slate-500 mb-3">
        So sánh hai biểu thức (ví dụ "D10" so với "D11+D12"). Mức Lỗi chặn nộp, mức Cảnh báo chỉ cần xác nhận.
      </p>

      {rules.length > 0 && (
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg mb-4" data-testid="rule-list">
          {rules.map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-2 px-3 py-2 text-sm" data-testid={`rule-row-${i}`}>
              <div>
                <span className="font-medium text-slate-800">{r.name}</span>
                <span className="text-slate-500">
                  {' — '}{r.leftExpr} {DYN_REPORT_RULE_OPERATOR_LABEL[r.operator]} {r.rightExpr}
                  {' · '}{DYN_REPORT_RULE_SEVERITY_LABEL[r.severity]}
                </span>
              </div>
              <button
                type="button"
                data-testid={`btn-remove-rule-${i}`}
                onClick={() => removeRule(i)}
                className={`text-slate-400 hover:text-red-600 ${A11Y_FOCUS_RING}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border border-slate-200 rounded-lg p-3 mb-4 space-y-2">
        <input
          type="text"
          data-testid="input-rule-name"
          placeholder="Tên quy tắc"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
        />
        <div className="grid grid-cols-3 gap-2">
          <input
            type="text"
            data-testid="input-rule-left"
            placeholder="Vế trái, vd D10"
            value={draft.leftExpr}
            onChange={(e) => setDraft((d) => ({ ...d, leftExpr: e.target.value }))}
            className="border border-slate-300 rounded px-2 py-1.5 text-sm"
          />
          <select
            data-testid="select-rule-operator"
            value={draft.operator}
            onChange={(e) => setDraft((d) => ({ ...d, operator: e.target.value as DynReportRuleOperator }))}
            className="border border-slate-300 rounded px-2 py-1.5 text-sm"
          >
            {OPERATORS.map((op) => (
              <option key={op} value={op}>
                {DYN_REPORT_RULE_OPERATOR_LABEL[op]}
              </option>
            ))}
          </select>
          <input
            type="text"
            data-testid="input-rule-right"
            placeholder="Vế phải, vd D11+D12"
            value={draft.rightExpr}
            onChange={(e) => setDraft((d) => ({ ...d, rightExpr: e.target.value }))}
            className="border border-slate-300 rounded px-2 py-1.5 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select
            data-testid="select-rule-severity"
            value={draft.severity}
            onChange={(e) => setDraft((d) => ({ ...d, severity: e.target.value as DynReportRuleSeverity }))}
            className="border border-slate-300 rounded px-2 py-1.5 text-sm"
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {DYN_REPORT_RULE_SEVERITY_LABEL[s]}
              </option>
            ))}
          </select>
          <input
            type="text"
            data-testid="input-rule-message"
            placeholder="Thông báo khi vi phạm"
            value={draft.message}
            onChange={(e) => setDraft((d) => ({ ...d, message: e.target.value }))}
            className="border border-slate-300 rounded px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="button"
          data-testid="btn-add-rule"
          disabled={!canAdd}
          onClick={addRule}
          className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50 rounded-lg disabled:opacity-40 ${A11Y_FOCUS_RING}`}
        >
          <Plus className="w-4 h-4" />
          Thêm quy tắc
        </button>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className={`flex items-center gap-1 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg ${A11Y_FOCUS_RING}`}
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại
        </button>
        <button
          type="button"
          data-testid="btn-rules-next"
          onClick={() => onNext(rules)}
          className={`flex items-center gap-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 ${A11Y_FOCUS_RING}`}
        >
          Tiếp theo: Tổng kết
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
