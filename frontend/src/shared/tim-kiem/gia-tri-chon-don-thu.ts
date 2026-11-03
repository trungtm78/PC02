import { HuongXuLyDon, PetitionStatus } from '@/shared/enums/generated';
import { HUONG_XU_LY_LABEL } from '@/shared/enums/huong-xu-ly';
import { PETITION_STATUS_LABEL } from '@/shared/enums/status-labels';

/**
 * Values of the SELECT tags of the petition search declaration (`TIM_KIEM_DON_THU`): the code goes in the URL and to the
 * server, the officer reads the label.
 *
 * ONE table for every screen that offers the petition tags (list, Restore, Export reports). Each used to keep its own
 * copy, so a new select field was usable on one screen and silently absent on the others - `OTimKiemThe` offers a select
 * field's values only when the table has an entry for it. The gate `gia-tri-chon-don-thu.test.ts` keeps it complete.
 */
export const GIA_TRI_CHON_DON_THU = {
  // Status: searched by CODE; labels come from the same table the status column uses.
  trangThai: Object.values(PetitionStatus).map((v) => ({
    value: v,
    label: PETITION_STATUS_LABEL[v],
  })),
  // Handling direction: "Chuyển đơn", "Giao đơn", "Trả đơn/Lưu đơn".
  huongXuLy: (Object.keys(HUONG_XU_LY_LABEL) as HuongXuLyDon[]).map((v) => ({
    value: v,
    label: HUONG_XU_LY_LABEL[v],
  })),
  // Boolean column: the tag value is a key of `giaTriCot` on the server (co / khong).
  laCongNgheCao: [
    { value: 'co', label: 'Có' },
    { value: 'khong', label: 'Không' },
  ],
} as const;
