import { createListFilterRegistry, type FilterField } from "@/features/_shared/list-filters/registry";
import {
  CASE_STATUS_OPTIONS,
  LOAI_UY_THAC_OPTIONS,
} from "@/shared/enums/status-labels";

export interface UyThacFilterValue {
  caseStatus?: string;
  loaiUyThac?: string;
  donViGiao?: string;
  investigatorSearch?: string;
  ngayTiepNhanFrom?: string;
  ngayTiepNhanTo?: string;
}

const common = [
  {
    key: "caseStatus",
    label: "Trạng thái vụ án",
    type: "enumSelect",
    urlKey: "cs",
    testid: "filter-case-status",
    options: [...CASE_STATUS_OPTIONS],
  },
  {
    key: "loaiUyThac",
    label: "Loại ủy thác",
    type: "enumSelect",
    urlKey: "lut",
    testid: "filter-loai-uy-thac",
    options: [...LOAI_UY_THAC_OPTIONS],
  },
  {
    key: "ngayTiepNhanFrom",
    label: "Ngày tiếp nhận từ",
    type: "date",
    urlKey: "tnf",
    testid: "filter-from-date",
  },
  {
    key: "ngayTiepNhanTo",
    label: "Ngày tiếp nhận đến",
    type: "date",
    urlKey: "tnt",
    testid: "filter-to-date",
  },
] satisfies FilterField<UyThacFilterValue>[];

const legacyText = [
  {
    key: "donViGiao",
    label: "Đơn vị giao",
    type: "text",
    urlKey: "dv",
    testid: "filter-don-vi-giao",
    placeholder: "PC01, CA quận X...",
  },
  {
    key: "investigatorSearch",
    label: "Điều tra viên",
    type: "text",
    urlKey: "inv",
    testid: "filter-investigator",
    placeholder: "Tên điều tra viên...",
  },
] satisfies FilterField<UyThacFilterValue>[];

export const uyThacListFilters =
  createListFilterRegistry<UyThacFilterValue>().registerMany([...common]);
export const uyThacLegacyListFilters =
  createListFilterRegistry<UyThacFilterValue>().registerMany([
    ...common,
    ...legacyText,
  ]);
