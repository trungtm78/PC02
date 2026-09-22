/**
 * Sinh danh mục TRƯỜNG FORM của Đơn thư cho bảng xuất "đầy đủ".
 *
 * Anh yêu cầu 22/09/2026: xuất "toàn bộ các field đang được đăng ký trong màn hình đăng ký/sửa
 * đơn thư". Nguồn sự thật của "đang được đăng ký" là bố cục hệ cũ ở FRONTEND
 * (`features/cases/legacy-form-layout.def.ts`) — 131 ô trên 10 tab, và Đơn thư bỏ đi vài ô.
 *
 * Chép tay 131 nhãn sang máy chủ là 131 cơ hội gõ sai, và không ai biết khi bố cục đổi. Nên
 * SINH ra, commit bản sinh, và có cổng chạy lại bộ sinh rồi so — đúng khuôn `gen:tim-kiem` và
 * `gen:enums` đang dùng.
 *
 * Chạy: `npm run gen:khai-xuat-day-du`
 */
import * as fs from 'fs';
import * as path from 'path';

const GOC = path.resolve(__dirname, '..', '..');
const BO_CUC = path.join(GOC, 'frontend', 'src', 'features', 'cases', 'legacy-form-layout.def.ts');
const O_AN = path.join(GOC, 'frontend', 'src', 'features', 'petitions', 'o-an.def.ts');
const RANG_BUOC = path.join(GOC, 'frontend', 'src', 'features', 'petitions', 'legacy-form-binding.ts');
const RA = path.join(GOC, 'backend', 'src', 'petitions', 'khai-truong-form-don-thu.generated.ts');

export interface TruongForm {
  /** Tên ô theo ĐẶC TẢ hệ cũ. */
  field: string;
  /** Nhãn nguyên văn trên màn. */
  caption: string;
  /** Cột thật trên bảng `petitions`, hoặc `null` nếu nằm trong `metadata`. */
  cot: string | null;
  /**
   * KHOÁ THẬT dùng để đọc giá trị: tên cột nếu có cột riêng, không thì khoá trong `metadata`.
   *
   * KHÔNG phải lúc nào cũng bằng `field`. Ô của nhánh `statistic.` bên Vụ án được `dichLuu`
   * (`legacy-form-binding.ts:107`) CẮT tiền tố trước khi lưu, nên đọc bằng `field` là đọc một
   * khoá không tồn tại — 44 trường ra ô trống mà tệp vẫn đủ cột, đủ tiêu đề.
   */
  khoaLuu: string;
}

/** Ô của bố cục, theo THỨ TỰ xuất hiện; ô trùng tên ở nhiều tab chỉ lấy lần đầu. */
export function docBoCuc(src: string): { field: string; caption: string }[] {
  const ra: { field: string; caption: string }[] = [];
  const thay = new Set<string>();
  /*
    Mỗi mục là một literal `{ caption: "...", field: "...", ... }` trên MỘT dòng.

    Không xử dấu nháy thoát trong nhãn — đã đo: 0/181 nhãn chứa. Viết phép dò rộng hơn thực tế
    chỉ thêm chỗ để sai mà không mua được gì.
  */
  /*
    Nhận CẢ HAI thứ tự khoá trong literal.

    Bản đầu chỉ nhận `caption` đứng trước `field`. Lượt soát mô hình ngoài chèn một ô hợp lệ
    với `field` đứng trước `caption` — cả năm mệnh đề của bộ sinh vẫn xanh, mà ô ấy biến mất
    khỏi tệp xuất. Bộ dò đọc HẸP hơn thực tế thì cổng của nó chỉ canh được đúng cách viết mình
    quen.
  */
  const re =
    /\{[^{}]*?(?:caption:\s*"([^"]*)"[^{}]*?field:\s*"([^"]+)"|field:\s*"([^"]+)"[^{}]*?caption:\s*"([^"]*)")[^{}]*?\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const caption = m[1] ?? m[4];
    const field = m[2] ?? m[3];
    if (!field || thay.has(field)) continue;
    thay.add(field);
    ra.push({ field, caption });
  }
  return ra;
}

/** Ánh xạ ô đặc tả → cột thật của Đơn thư (`CO_COT_RIENG`). */
export function docAnhXaCot(src: string): Record<string, string> {
  const i = src.indexOf('CO_COT_RIENG');
  const j = src.indexOf('};', i);
  const ra: Record<string, string> = {};
  const re = /'?([A-Za-z0-9_.]+)'?\s*:\s*'([A-Za-z0-9_]+)'/g;
  let m: RegExpExecArray | null;
  const khoi = src.slice(i, j);
  while ((m = re.exec(khoi))) ra[m[1]] = m[2];
  return ra;
}

/** Ô đã bỏ khỏi form Đơn thư (`KHOA_HE_CU_DA_AN`) và ô đã có chỗ khác (`BO_O_DA_CO_CHO_KHAC`). */
export function docOBo(oAn: string, rangBuoc: string): Set<string> {
  const ra = new Set<string>();
  const i = oAn.indexOf('KHOA_HE_CU_DA_AN');
  const j = oAn.indexOf('];', i);
  for (const m of oAn.slice(i, j).matchAll(/"([A-Za-z0-9_]+)"/g)) ra.add(m[1]);
  const k = rangBuoc.indexOf('BO_O_DA_CO_CHO_KHAC');
  const l = rangBuoc.indexOf(']);', k);
  for (const m of rangBuoc.slice(k, l).matchAll(/\['([A-Za-z0-9_]+)'/g)) ra.add(m[1]);
  return ra;
}

/**
 * Ô CHỈ Đơn thư mới có — không nằm trong bố cục hệ cũ nên bộ dò không thấy.
 *
 * Lượt soát mô hình ngoài 23/09/2026 chỉ ra: tệp "đầy đủ" thiếu đúng ba ô cán bộ nhìn thấy và
 * gõ được trên màn. Anh yêu cầu "toàn bộ các field đang được ĐĂNG KÝ trong màn đăng ký/sửa",
 * nên thước đo là MÀN HÌNH, không phải bố cục hệ cũ.
 *
 *  - `donViGiaiQuyet` + `huongXuLy`: khối "Nội dung phiếu đề xuất" dựng riêng; ô hệ cũ
 *    `supervisingUnit` đã bị `BO_O_DA_CO_CHO_KHAC` loại vì ghi vào CÙNG cột.
 *  - `deXuat`: cùng khối ấy, ô "Đề xuất xử lý".
 */
const O_RIENG_DON_THU: TruongForm[] = [
  { field: 'huongXuLy', caption: 'Hướng xử lý', cot: 'huongXuLy', khoaLuu: 'huongXuLy' },
  { field: 'donViGiaiQuyet', caption: 'Đơn vị xử lý', cot: 'donViGiaiQuyet', khoaLuu: 'donViGiaiQuyet' },
  { field: 'deXuat', caption: 'Đề xuất xử lý', cot: 'deXuat', khoaLuu: 'deXuat' },
];

export function dungDanhMuc(
  boCuc: string,
  anhXa: string,
  oAn: string,
  rangBuoc: string,
): TruongForm[] {
  const bo = docOBo(oAn, rangBuoc);
  const cot = docAnhXaCot(anhXa);
  return docBoCuc(boCuc)
    .filter((o) => !bo.has(o.field))
    .map((o): TruongForm => {
      const c = cot[o.field] ?? null;
      return {
        field: o.field,
        caption: o.caption,
        cot: c,
        // Cùng luật `dichLuu`: cột riêng nếu có, không thì khoá `metadata` ĐÃ CẮT `statistic.`.
        khoaLuu: c ?? o.field.replace('statistic.', ''),
      };
    })
    .concat(O_RIENG_DON_THU);
}

if (require.main === module) {
  const ds = dungDanhMuc(
    fs.readFileSync(BO_CUC, 'utf8'),
    fs.readFileSync(RANG_BUOC, 'utf8'),
    fs.readFileSync(O_AN, 'utf8'),
    fs.readFileSync(RANG_BUOC, 'utf8'),
  );
  const noi = `/* SINH TỰ ĐỘNG — đừng sửa tay. Chạy lại: npm run gen:khai-xuat-day-du */
/* Nguồn: frontend/src/features/cases/legacy-form-layout.def.ts (bố cục hệ cũ),
   trừ ô đã bỏ khỏi Đơn thư (o-an.def.ts) và ô đã có chỗ khác (legacy-form-binding.ts). */

export interface TruongFormDonThu {
  /** Tên ô theo đặc tả hệ cũ. */
  field: string;
  /** Nhãn nguyên văn trên màn — dùng làm tiêu đề cột Excel. */
  caption: string;
  /** Cột thật trên bảng \`petitions\`; \`null\` = nằm trong \`metadata\`. */
  cot: string | null;
  /** Khoá THẬT để đọc giá trị — cột riêng, hoặc khoá \`metadata\` đã cắt \`statistic.\`. */
  khoaLuu: string;
}

export const TRUONG_FORM_DON_THU: readonly TruongFormDonThu[] = ${JSON.stringify(ds, null, 2)};
`;
  fs.writeFileSync(RA, noi, 'utf8');
  console.log(
    `[gen-khai-xuat-day-du] ${ds.length} trường (${ds.filter((d) => d.cot).length} cột riêng, ${ds.filter((d) => !d.cot).length} trong metadata) → ${path.relative(GOC, RA)}`,
  );
}
