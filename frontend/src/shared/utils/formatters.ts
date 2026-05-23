const VND_FORMATTER = new Intl.NumberFormat('vi-VN');

export function formatVND(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const num = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(num)) return '';
  return `${VND_FORMATTER.format(num)} ₫`;
}

export function parseVND(formatted: string | null | undefined): number | null {
  if (formatted === null || formatted === undefined) return null;
  const trimmed = formatted.trim();
  if (trimmed === '') return null;
  const digits = trimmed.replace(/[^\d]/g, '');
  if (digits === '') return null;
  return Number(digits);
}

export function formatPhone(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 10) return value;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`;
}

export function parsePhone(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value.replace(/\s/g, '');
}

export function hydrateLegacyPhone(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('84') && digits.length === 11) {
    digits = '0' + digits.slice(2);
  }
  return digits;
}
