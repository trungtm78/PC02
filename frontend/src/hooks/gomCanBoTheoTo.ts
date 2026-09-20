import type { OfficerOption } from "@/hooks/useOfficerOptions";

/** Dùng thẳng hình `FKGroup` của ô chọn — một hình duy nhất, khỏi dịch qua lại ở chỗ gọi. */
export interface NhomCanBo {
  key: string;
  label: string;
  options: OfficerOption[];
}

export const NHOM_CHUA_CO_TO = "__chua-co-to__";
export const NHAN_CHUA_CO_TO = "Chưa có tổ";

/** Nhóm GHIM đầu danh sách — dành cho người hồ sơ đang trỏ tới mà không còn hoạt động. */
export const NHOM_GHIM = "__ghim__";
export const NHAN_GHIM = "Đang chọn";

/**
 * MỘT nhóm cho toàn bộ tổ địa bàn (công an phường/xã).
 *
 * Đo prod 20/09: 241 cán bộ hoạt động trải trên 207 tổ có người, trong đó 167 tổ là công an
 * phường/xã mỗi nơi ĐÚNG MỘT tài khoản. Gom thẳng theo tổ thì ô chọn mọc ra 167 tiêu đề nhóm
 * một người, chắn mất hai tổ công tác thật (PC02 18 người, Tổ công tác Số 2 13 người).
 *
 * Đo tiếp: trong 47.941 đơn thư chỉ 34 người từng được giao hoặc nhập đơn, và KHÔNG một ai
 * thuộc tổ địa bàn. Nhưng vẫn giữ họ trong danh sách — bỏ đi là tự quyết rằng PC02 sẽ không
 * bao giờ giao đơn cho công an phường, mà đó không phải việc của tầng hiển thị.
 */
export const NHOM_DIA_BAN = "__dia-ban__";
export const NHAN_DIA_BAN = "Công an phường/xã";

/**
 * Xếp danh sách cán bộ thành các nhóm theo Tổ, để ô chọn hiện được như hệ cũ:
 *
 *     * Tổ 1
 *         Nguyễn Văn A
 *         Nguyễn Văn B
 *     * Tổ 2
 *         Nguyễn Văn E
 *
 * Ba điều dễ làm hỏng, nên chốt ở đây chứ không để mỗi nơi tự xoay:
 *
 * 1. **Một người có thể thuộc NHIỀU tổ** (`user_teams` là bảng nối) — phải hiện ở MỌI tổ của
 *    mình. Chỉ hiện ở tổ đầu tiên là cán bộ tìm trong tổ kia không thấy người mình cần.
 * 2. **Người chưa thuộc tổ nào vẫn phải chọn được.** Bỏ họ ra là danh sách thiếu người mà
 *    không ai báo — đúng kiểu hỏng im lặng vừa sửa ở lời gọi `limit: 200`.
 * 3. **Tổ trưởng xếp đầu nhóm.** Đó là lý do `isLeader` được giữ suốt từ máy chủ xuống.
 */
export function gomCanBoTheoTo(
  dsCanBo: OfficerOption[],
  /** Id cần GHIM đầu danh sách (người hồ sơ đang trỏ tới nhưng không còn trong danh mục). */
  ghimId?: string,
): NhomCanBo[] {
  const theoTo = new Map<string, { label: string; options: OfficerOption[] }>();
  const chuaCoTo: OfficerOption[] = [];
  const ghim: OfficerOption[] = [];
  const diaBan: OfficerOption[] = [];

  for (const canBo of dsCanBo) {
    // Người đang được chọn mà không còn hoạt động được GHIM đầu, không đẩy xuống "Chưa có tổ"
    // ở tận đáy danh sách 245 người — đúng người hồ sơ đang trỏ tới thì phải nhìn thấy ngay.
    if (ghimId && canBo.value === ghimId && canBo.teams.length === 0) {
      ghim.push(canBo);
      continue;
    }
    if (canBo.teams.length === 0) {
      chuaCoTo.push(canBo);
      continue;
    }
    for (const to of canBo.teams) {
      if (to.laDiaBan) {
        // Gộp vào MỘT nhóm, nhưng giữ tên đơn vị trong nhãn của từng người: cán bộ gõ
        // "Chợ Quán" vẫn ra đúng người, và không ai mất danh tính đơn vị mình.
        if (!diaBan.some((m) => m.value === canBo.value)) {
          diaBan.push({ ...canBo, label: `${canBo.label} — ${to.teamName}` });
        }
        continue;
      }
      const nhom = theoTo.get(to.teamId) ?? { label: to.teamName, options: [] };
      nhom.options.push(canBo);
      theoTo.set(to.teamId, nhom);
    }
  }

  const laToTruong = (canBo: OfficerOption, teamId: string) =>
    canBo.teams.some((t) => t.teamId === teamId && t.isLeader);

  const nhomCoTo: NhomCanBo[] = [...theoTo.entries()]
    .map(([teamId, { label, options }]) => ({
      key: teamId,
      label,
      // Tổ trưởng lên đầu; phần còn lại giữ nguyên thứ tự đã sắp theo tên ở `useOfficerOptions`.
      options: [
        ...options.filter((m) => laToTruong(m, teamId)),
        ...options.filter((m) => !laToTruong(m, teamId)),
      ],
    }))
    // `numeric: true` là phần bắt buộc, không phải trang trí: tên tổ thật trên bản chạy là
    // "Tổ CT số 4" … "Tổ CT số 10". So chuỗi thuần xếp 10 TRƯỚC 4, nên cán bộ tìm tổ mình
    // phải quét cả danh sách.
    .sort((a, b) => a.label.localeCompare(b.label, "vi", { numeric: true }));

  // Nhóm "Chưa có tổ" LUÔN ở cuối, và chỉ dựng khi thật sự có người — nhóm rỗng là một dòng
  // tiêu đề vô nghĩa chắn tầm mắt.
  const dauDanhSach: NhomCanBo[] =
    ghim.length > 0 ? [{ key: NHOM_GHIM, label: NHAN_GHIM, options: ghim }] : [];

  // Thứ tự cuối cùng: GHIM → tổ chức năng → công an phường/xã → chưa có tổ.
  // Nhóm địa bàn đứng sau tổ công tác vì 100% lượt giao đơn đo được đều rơi vào tổ công tác;
  // vẫn đứng TRƯỚC "Chưa có tổ" vì họ có đơn vị rõ ràng, chỉ là đơn vị khác loại.
  const duoiDanhSach: NhomCanBo[] = [
    ...(diaBan.length > 0
      ? [{ key: NHOM_DIA_BAN, label: NHAN_DIA_BAN, options: diaBan }]
      : []),
    ...(chuaCoTo.length > 0
      ? [{ key: NHOM_CHUA_CO_TO, label: NHAN_CHUA_CO_TO, options: chuaCoTo }]
      : []),
  ];

  return [...dauDanhSach, ...nhomCoTo, ...duoiDanhSach];
}
