/**
 * Ma trận phân quyền của một vai trò, dựng từ DANH MỤC THẬT của máy chủ (`GET /admin/permissions`).
 *
 * Trước 19/09/2026 màn này dùng lưới cứng 8 nhóm × 5 thao tác, trong khi danh mục prod có 16 nhóm × 9
 * thao tác: lưới chỉ phủ 22/56 quyền ADMIN, 11/17 OFFICER, 0/3 DEADLINE_APPROVER — "Lưu" gửi lại lưới là
 * xoá phần ngoài lưới. Nay: hàng/cột là đúng những gì danh mục có; quyền vai trò đang giữ mà danh mục
 * không liệt kê được mang nguyên khi lưu, không âm thầm bỏ.
 */
export interface QuyenCap {
  action: string;
  subject: string;
}

/** `true`/`false` = ô có trong danh mục (đang tích / không); `null` = danh mục không có quyền ấy. */
export interface MaTranQuyen {
  subjects: string[];
  actions: string[];
  o: Record<string, Record<string, boolean | null>>;
  /** Quyền vai trò đang giữ mà danh mục không có — giữ nguyên khi lưu. */
  ngoaiDanhMuc: QuyenCap[];
}

/** Thứ tự cột quen mắt; thao tác mới của danh mục (chưa có ở đây) nối sau theo ABC. */
const THU_TU_ACTION = [
  'read',
  'write',
  'edit',
  'delete',
  'restore',
  'approve',
  'export',
  'request_changes',
  'withdraw_own',
  'review_reset_request',
];

const khoa = (p: QuyenCap) => `${p.action}:${p.subject}`;

export function dungMaTran(
  danhMuc: readonly QuyenCap[],
  cuaVaiTro: readonly QuyenCap[],
): MaTranQuyen {
  const subjects = [...new Set(danhMuc.map((p) => p.subject))].sort();
  const coTrongDanhMuc = new Set(danhMuc.map((p) => p.action));
  const actions = [
    ...THU_TU_ACTION.filter((a) => coTrongDanhMuc.has(a)),
    ...[...coTrongDanhMuc].filter((a) => !THU_TU_ACTION.includes(a)).sort(),
  ];
  const trongDanhMuc = new Set(danhMuc.map(khoa));
  const dangGiu = new Set(cuaVaiTro.map(khoa));

  const o: MaTranQuyen['o'] = {};
  for (const subject of subjects) {
    o[subject] = {};
    for (const action of actions) {
      const k = khoa({ action, subject });
      o[subject][action] = trongDanhMuc.has(k) ? dangGiu.has(k) : null;
    }
  }
  return {
    subjects,
    actions,
    o,
    ngoaiDanhMuc: cuaVaiTro.filter((p) => !trongDanhMuc.has(khoa(p))),
  };
}

/** Bộ quyền gửi lên `PATCH /admin/roles/:id/permissions` — thay trọn bộ. */
export function danhSachGui(mt: MaTranQuyen): QuyenCap[] {
  const ra: QuyenCap[] = [];
  for (const subject of mt.subjects) {
    for (const action of mt.actions) {
      if (mt.o[subject]?.[action] === true) ra.push({ action, subject });
    }
  }
  return [...ra, ...mt.ngoaiDanhMuc];
}

/** Quyền được thêm / bị bỏ so với bản đã tải — để hộp xác nhận nói rõ hậu quả trước khi lưu. */
export function soSanhMaTran(
  goc: MaTranQuyen,
  moi: MaTranQuyen,
): { them: string[]; bo: string[] } {
  const truoc = danhSachGui(goc).map(khoa);
  const sau = danhSachGui(moi).map(khoa);
  const coTruoc = new Set(truoc);
  const coSau = new Set(sau);
  return {
    them: sau.filter((k) => !coTruoc.has(k)),
    bo: truoc.filter((k) => !coSau.has(k)),
  };
}
