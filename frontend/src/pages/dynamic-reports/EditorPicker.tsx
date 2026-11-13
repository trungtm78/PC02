/**
 * The people who may type for a team in a period: the ones chosen so far, each with a way to take them off, and one
 * select to add another. Uses the same officer list and grouping as the report wizard's team step, so the same
 * person appears under the same team in both places.
 */
import { X } from 'lucide-react';
import { useOfficerOptions } from '@/hooks/useOfficerOptions';
import { gomCanBoTheoTo } from '@/hooks/gomCanBoTheoTo';
import { FKSelect } from '@/components/FKSelect';
import { A11Y_FOCUS_RING } from '@/constants/styles';

export interface EditorPickerProps {
  value: string[];
  onChange: (next: string[]) => void;
  /** Prefix of the test ids: the select is `${testId}`, each remove button `btn-remove-editor-${userId}`. */
  testId: string;
  /** Names the server already gave for people in `value`, for anyone the officer list no longer has. */
  knownNames?: Record<string, string>;
}

export default function EditorPicker({ value, onChange, testId, knownNames = {} }: EditorPickerProps) {
  const { data: officers = [], isLoading } = useOfficerOptions();
  const groups = gomCanBoTheoTo(officers.filter((o) => !value.includes(o.value)));
  const nameOf = (userId: string) => officers.find((o) => o.value === userId)?.label ?? knownNames[userId] ?? userId;

  return (
    <div data-testid={`${testId}-box`}>
      <ul className="flex flex-wrap gap-2 mb-2" data-testid={`${testId}-chosen`}>
        {value.map((id) => (
          <li key={id} className="inline-flex items-center gap-1 bg-slate-100 rounded px-2 py-1 text-sm text-slate-800">
            {nameOf(id)}
            <button
              type="button"
              aria-label={`Bỏ ${nameOf(id)}`}
              data-testid={`btn-remove-editor-${id}`}
              onClick={() => onChange(value.filter((v) => v !== id))}
              className={`text-slate-400 hover:text-red-600 ${A11Y_FOCUS_RING}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </li>
        ))}
        {value.length === 0 && <li className="text-sm text-amber-700">Chưa chọn người nhập</li>}
      </ul>
      <FKSelect
        label=""
        value=""
        onChange={(userId) => {
          if (userId && !value.includes(userId)) onChange([...value, userId]);
        }}
        groups={groups}
        loading={isLoading}
        placeholder="-- Thêm người nhập --"
        testId={testId}
      />
    </div>
  );
}
