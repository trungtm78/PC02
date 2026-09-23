import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { LegacyLayoutSection } from '@/components/legacy-form/LegacyLayoutSection';
import type { LegacyFormSpec } from '../types';

/**
 * CỔNG NỐI DÂY: bộ dựng ô ngày có THẬT SỰ gọi `giaTriONgay` không.
 *
 * ĐỪNG THÊM CA "CHUỖI RÁC" VÀO ĐÂY — đo 23/09/2026 và đã cắt 6 ca như thế vì chúng trang trí:
 *
 *     jsdom, <input type="date" value="undefined">  →  ""      (làm sạch y hệt Chromium)
 *     jsdom, value="2021-02-30"                     →  ""
 *
 * jsdom mô phỏng đúng cái engine KHÔNG có lỗi. Nên ca kiểm "chuỗi rác không lọt ra ô" xanh kể
 * cả khi bộ dựng bỏ hẳn `giaTriONgay` — gieo lỗi 23/09 chứng minh: 6/8 ca ấy vẫn xanh.
 *
 * Lỗi thật nằm ở WebKit (engine Safari), đo bằng Playwright cùng ngày:
 *     WebKit,   value="undefined"  →  "undefined"   (GIỮ NGUYÊN chuỗi rác)
 *     Chromium, value="undefined"  →  ""
 * Chuỗi rác sống sót trên máy macOS rồi đi lên máy chủ lúc bấm Lưu. KHÔNG bộ kiểm jsdom nào
 * nhìn thấy được điều đó.
 *
 * Nên phân vai: `giaTriONgay.test.ts` là cổng THẬT (hàm thuần, không qua DOM, gieo lỗi đỏ 3
 * ca). Tệp này chỉ chứng minh bộ dựng có gọi hàm ấy — và mệnh đề ISO dưới đây là mệnh đề DUY
 * NHẤT làm được việc đó, vì nó đòi một giá trị CỤ THỂ chứ không đòi chuỗi rỗng.
 */

type Form = { ngayThu: string };

const SPEC: LegacyFormSpec<Form, 'tab1', 'ngayThu'> = {
  entity: 'case',
  tabLabel: { tab1: 'Tab thử' },
  layout: [{ caption: 'Ngày thử', field: 'ngayThu', kind: 'date', span: 'half', tab: 'tab1' }] as never,
  read: (form, field) => (form as Record<string, string>)[field] ?? '',
  write: (form, field, value) => ({ ...form, [field]: value }) as Form,
  fieldToColumn: { ngayThu: 'ngay_thu' },
};

function DungLayout({ giaTri }: { giaTri: unknown }) {
  const [formData, setFormData] = useState({ ngayThu: giaTri } as unknown as Form);
  return (
    <LegacyLayoutSection
      spec={SPEC}
      items={SPEC.layout as never}
      formData={formData}
      setFormData={setFormData}
    />
  );
}

const oNgay = () => screen.getByLabelText(/Ngày thử/) as HTMLInputElement;

describe('CỔNG: bộ dựng bố cục hệ cũ có gọi giaTriONgay', () => {
  it('ô ngày hợp lệ hiện đúng — mốc chống dựng hỏng', () => {
    render(<DungLayout giaTri="2021-03-15" />);
    // Mốc: mệnh đề này đỏ thì bộ dựng hỏng, và mệnh đề dưới trở nên vô nghĩa.
    expect(oNgay().type).toBe('date');
    expect(oNgay().value).toBe('2021-03-15');
  });

  it('dấu thời gian ISO bị CẮT về phần ngày, không lệch múi giờ', () => {
    // Mệnh đề duy nhất bắt được việc gỡ `giaTriONgay`: nó đòi một giá trị CỤ THỂ.
    // Bỏ hàm đi thì jsdom làm sạch chuỗi ISO về "" và mệnh đề này đỏ ngay.
    // Chọn 23:59:59Z có chủ ý: đi qua `new Date` thì giờ Việt Nam đẩy sang 16/03.
    render(<DungLayout giaTri="2021-03-15T23:59:59.000Z" />);
    expect(oNgay().value).toBe('2021-03-15');
  });
});
