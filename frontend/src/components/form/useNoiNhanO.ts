import { useId } from 'react';

/**
 * id ô + id lời lỗi + ba thuộc tính aria cho một ô nhập — MỘT chỗ cho mọi ô form (20/09/2026: FormPhone / FormCurrency /
 * FormInteger từng thiếu, nhãn không nối với ô).
 */
export function useNoiNhanO(required?: boolean, error?: string) {
  const id = useId();
  const errorId = error ? `${id}-loi` : undefined;
  const aria = {
    'aria-required': required || undefined,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': errorId,
  } as const;
  return { id, errorId, aria };
}
