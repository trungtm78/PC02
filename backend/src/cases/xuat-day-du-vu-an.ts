import {
  buildFormExport,
  readValue,
} from '../common/xuat-danh-sach/xuat-day-du-model';
import type { KhaiCotXuat } from '../common/xuat-danh-sach/xuat-danh-sach';
import { TRUONG_FORM_VU_AN } from '../common/xuat-danh-sach/khai-truong-ho-so.generated';

const registry = buildFormExport('Case', TRUONG_FORM_VU_AN);
export const KHAI_COT_XUAT_VU_AN_DAY_DU = registry.columns;
export const COT_CAN_CHO_XUAT_DAY_DU_VU_AN = {
  ...registry.select,
  subjects: {
    where: { deletedAt: null },
    select: {
      caseId: true,
      fullName: true,
      dateOfBirth: true,
      gender: true,
      idNumber: true,
      address: true,
      phone: true,
      occupationId: true,
      nationalityId: true,
      districtId: true,
      wardId: true,
      districtName: true,
      crimeId: true,
      type: true,
      status: true,
      notes: true,
    },
  },
  evidences: {
    where: { deletedAt: null },
    select: {
      caseId: true,
      code: true,
      name: true,
      description: true,
      quantity: true,
      unit: true,
      storageLocation: true,
      receivedDate: true,
      status: true,
      evidenceType: true,
      entryOrder: true,
      warehouseReceipt: true,
    },
  },
  documents: {
    where: { deletedAt: null },
    select: {
      caseId: true,
      title: true,
      description: true,
      originalName: true,
      mimeType: true,
      size: true,
      documentType: true,
      recordedAt: true,
    },
  },
};

function columns(
  labels: readonly (readonly [string, string])[],
): KhaiCotXuat<Record<string, unknown>>[] {
  return labels.map(([key, tieuDe]) => ({
    key,
    tieuDe,
    rong: 24,
    doc: (row) => readValue(row[key]),
  }));
}

export const COT_DOI_TUONG = columns([
  ['caseId', 'Mã định danh hồ sơ'],
  ['fullName', 'Họ tên đối tượng'],
  ['dateOfBirth', 'Ngày sinh'],
  ['gender', 'Giới tính'],
  ['idNumber', 'Số CCCD/CMND'],
  ['address', 'Địa chỉ'],
  ['phone', 'Số điện thoại'],
  ['occupationId', 'Nghề nghiệp'],
  ['nationalityId', 'Quốc tịch'],
  ['districtId', 'Mã quận/huyện'],
  ['wardId', 'Mã phường/xã'],
  ['districtName', 'Quận/huyện'],
  ['crimeId', 'Mã tội danh'],
  ['type', 'Loại đối tượng'],
  ['status', 'Trạng thái'],
  ['notes', 'Ghi chú'],
]);

export const COT_VAT_CHUNG = columns([
  ['caseId', 'Mã định danh hồ sơ'],
  ['code', 'Mã vật chứng'],
  ['name', 'Tên vật chứng'],
  ['description', 'Mô tả'],
  ['quantity', 'Số lượng'],
  ['unit', 'Đơn vị tính'],
  ['storageLocation', 'Nơi lưu giữ'],
  ['receivedDate', 'Ngày tiếp nhận'],
  ['status', 'Trạng thái'],
  ['evidenceType', 'Loại vật chứng'],
  ['entryOrder', 'Thứ tự nhập'],
  ['warehouseReceipt', 'Phiếu nhập kho'],
]);

export const COT_TAI_LIEU = columns([
  ['caseId', 'Mã định danh hồ sơ'],
  ['title', 'Tiêu đề tài liệu'],
  ['description', 'Mô tả'],
  ['originalName', 'Tên tệp gốc'],
  ['mimeType', 'Loại tệp'],
  ['size', 'Dung lượng (byte)'],
  ['documentType', 'Loại tài liệu'],
  ['recordedAt', 'Ngày ghi nhận'],
]);
