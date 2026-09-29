import type { NhomOKhai } from '@/components/legacy-form/NhomOGap';
import type { IncidentFormData } from '@/pages/incidents/incident-form.types';
import { laNguonTrucTiep } from '@/shared/nguon-don/truc-tiep';

export const NHOM_O_VU_VIEC: readonly NhomOKhai<IncidentFormData>[] = [
  {
    khoa: 'dinh-danh-nguoi-cung-cap',
    nhan: 'Thông tin định danh người cung cấp tin',
    tab: 'info',
    o: ['sinhNamNguoiToGiac', 'cmndNguoiToGiac', 'ngayCapCccd', 'noiCapCccd'],
    moKhi: (formData) => laNguonTrucTiep(formData.chuyenTuDonVi),
  },
];
