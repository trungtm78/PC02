import { describe, it, expect } from 'vitest';
import { DUONG_DAN_FORM } from '../trangDangRanh';

/**
 * CỔNG: màn nào có `<form`/`onSubmit` ở CHÍNH tệp trang thì đường dẫn của nó phải được luật
 * `DUONG_DAN_FORM` nhận là màn nhập liệu — hoặc được khai tường minh ở `FORM_CHI_TRONG_HOP_THOAI`
 * kèm lý do (form chỉ nằm trong hộp thoại, đã có lưới hộp thoại + theo dõi gõ che).
 *
 * Bản đầu cổng lọc route bằng CHÍNH kiểu dấu hiệu tên nên màn tên lạ (`.../propose`,
 * `/cases/tdac-backfill`) lọt qua cả luật lẫn cổng (rà mã 18/09/2026). Nay cổng đọc mã nguồn trang
 * thật: thêm màn nhập liệu tên gì cũng bị bắt.
 */
const TEP_DINH_TUYEN = import.meta.glob('/src/features/*/routes.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const TEP_TRANG = import.meta.glob(['/src/pages/**/*.tsx', '/src/features/**/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Màn có form nhưng form chỉ mở trong hộp thoại trên màn danh sách/chi tiết. */
const FORM_CHI_TRONG_HOP_THOAI: Record<string, string> = {
  '/admin/deadline-rules/version/:id': 'lý do rút/yêu cầu sửa nhập trong ReasonRequiredModal',
  '/calendar': 'tạo/sửa sự kiện trong CreateEventModal / Modal',
  '/documents': 'tải tài liệu trong hộp role="dialog"',
  '/to-nhom': 'thêm/sửa tổ trong hộp "Form Modal"',
};

/** Trang tự khai "đang sửa dở" với sổ đăng ký (`useDauHieuDangSua`) — không cần luật đường dẫn. */
const TU_KHAI_SO_DANG_KY = /useDauHieuDangSua\(/;

const CO_FORM = /<form\b|onSubmit=/;

function nguonCua(duongImport: string, tepDinhTuyen: string): string | undefined {
  const goc = duongImport.startsWith('./')
    ? `${tepDinhTuyen.slice(0, tepDinhTuyen.lastIndexOf('/'))}/${duongImport.slice(2)}`
    : duongImport.replace(/^@\//, '/src/');
  return TEP_TRANG[`${goc}.tsx`] ?? TEP_TRANG[`${goc}/index.tsx`];
}

interface ManDinhTuyen {
  duong: string;
  nguon: string | undefined;
  tenTep: string;
}

const man: ManDinhTuyen[] = Object.entries(TEP_DINH_TUYEN).flatMap(([tep, src]) => {
  const importCua = new Map<string, string>();
  for (const m of src.matchAll(/const (\w+) = lazy\(\(\) =>\s*import\('([^']+)'\)/g)) importCua.set(m[1], m[2]);
  return [...src.matchAll(/path="([^"]+)"[^>]*?element=\{[^}]*?<(\w+)/g)].flatMap((m) => {
    const imp = importCua.get(m[2]);
    return imp ? [{ duong: m[1], nguon: nguonCua(imp, tep), tenTep: imp }] : [];
  });
});

describe('CỔNG màn nhập liệu — đọc mã nguồn trang thật', () => {
  it('cổng không rỗng: đọc được route và mã nguồn trang', () => {
    expect(man.length).toBeGreaterThanOrEqual(40);
    expect(man.filter((m) => !m.nguon).map((m) => `${m.duong} (${m.tenTep})`)).toEqual([]);
  });

  it('mọi màn có form: đường dẫn bị coi là nhập liệu, hoặc khai là form-trong-hộp-thoại', () => {
    const lot = man
      .filter((m) => m.nguon && CO_FORM.test(m.nguon))
      .filter((m) => !DUONG_DAN_FORM.test(m.duong) && !(m.duong in FORM_CHI_TRONG_HOP_THOAI))
      .filter((m) => !TU_KHAI_SO_DANG_KY.test(m.nguon ?? ''))
      .map((m) => `${m.duong} (${m.tenTep})`);
    expect(lot).toEqual([]);
  });

  it('gieo lỗi: màn có form với đường dẫn lạ bị cổng bắt', () => {
    expect(DUONG_DAN_FORM.test('/ho-so/tao')).toBe(false);
    const gia = [{ duong: '/ho-so/tao', nguon: '<form onSubmit={luu}>', tenTep: 'gia' }];
    const lot = gia.filter((m) => CO_FORM.test(m.nguon) && !DUONG_DAN_FORM.test(m.duong));
    expect(lot).toHaveLength(1);
  });
});
