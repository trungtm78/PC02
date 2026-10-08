/**
 * Hai panel "trường hệ cũ" (DynamicLegacyFields, LegacyParityFields) ở chế độ chỉ-đọc.
 *
 * Codex bắt: cả hai dùng `disabled` cho ô chữ. Trong Chromium chữ trong ô `disabled` KHÔNG bôi chọn / chép được —
 * trái đúng mục đích chế độ xem (chép dữ liệu ra chỗ khác). Ô chữ/số/ngày phải là `readOnly`; chỉ ô tích (readOnly
 * không chặn được) mới `disabled`.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DynamicLegacyFields } from '../DynamicLegacyFields';
import { LegacyParityFields } from '../LegacyParityFields';

vi.mock('@/shared/legacy/legacyFieldLabels.generated', async (orig) => ({ ...(await orig<object>()) }));

describe('DynamicLegacyFields — chỉ đọc', () => {
  it('ô chữ là readOnly (KHÔNG disabled) để vẫn chép được', () => {
    render(
      <DynamicLegacyFields
        entity="petition"
        values={{ ten_truong_thu_nghiem: 'Giá trị cần chép' }}
        onChange={() => {}}
        readOnly
      />,
    );
    fireEvent.click(screen.getByTestId('dynamic-legacy-toggle'));
    const o = screen.getByTestId('legacy-field-ten_truong_thu_nghiem') as HTMLInputElement;
    expect(o.readOnly).toBe(true);
    expect(o.disabled).toBe(false);
  });

  it('đối chứng: không chỉ-đọc thì sửa được', () => {
    render(
      <DynamicLegacyFields entity="petition" values={{ ten_truong_thu_nghiem: 'x' }} onChange={() => {}} />,
    );
    fireEvent.click(screen.getByTestId('dynamic-legacy-toggle'));
    const o = screen.getByTestId('legacy-field-ten_truong_thu_nghiem') as HTMLInputElement;
    expect(o.readOnly).toBe(false);
    expect(o.disabled).toBe(false);
  });
});

describe('LegacyParityFields — chỉ đọc', () => {
  it('mọi ô chữ/số/ngày là readOnly (không disabled); ô tích thì disabled', () => {
    render(<LegacyParityFields entity="petition" values={{}} onChange={() => {}} readOnly />);
    fireEvent.click(screen.getByTestId('parity-fields-toggle'));
    const oNhap = Array.from(document.querySelectorAll<HTMLInputElement>('[data-testid^="parity-field-"]'));
    expect(oNhap.length).toBeGreaterThan(0);
    for (const o of oNhap) {
      if (o.type === 'checkbox') {
        expect(o.disabled, `${o.getAttribute('data-testid')} (checkbox)`).toBe(true);
      } else {
        expect(o.readOnly, `${o.getAttribute('data-testid')}`).toBe(true);
        expect(o.disabled, `${o.getAttribute('data-testid')}`).toBe(false);
      }
    }
  });

  it('đối chứng: không chỉ-đọc thì không ô nào bị khoá', () => {
    render(<LegacyParityFields entity="petition" values={{}} onChange={() => {}} />);
    fireEvent.click(screen.getByTestId('parity-fields-toggle'));
    const oNhap = Array.from(document.querySelectorAll<HTMLInputElement>('[data-testid^="parity-field-"]'));
    expect(oNhap.length).toBeGreaterThan(0);
    for (const o of oNhap) {
      expect(o.readOnly).toBe(false);
      expect(o.disabled).toBe(false);
    }
  });
});
