import { PrismaClient, CaseStatus, IncidentStatus, PetitionStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { suyTrangThai, type TrangThaiSuy } from './suy-trang-thai-he-cu';

/**
 * Gán trạng thái cho hồ sơ di trú, suy từ ô chữ tự do của hệ cũ.
 *
 * ── Vì sao cần ──
 *
 * Đo trên máy thật 30/08/2026: 46.741/46.741 đơn thư đứng ở MOI_TIEP_NHAN và 4.605/4.723 vụ việc
 * ở TIEP_NHAN, kể cả hồ sơ đã trả cho công dân từ 2019. Hệ cũ KHÔNG có cột trạng thái giải
 * quyết — kết quả nằm ở đúng một ô chữ tự do `ket_qua_xu_ly_giai_quyet_khac`.
 *
 * ── Ba luật ──
 *
 * 1. **Chạy khô trước.** `--apply` mới ghi. Không có cờ ấy thì chỉ ghi sổ và in ra.
 * 2. **Chỉ gán nhóm KHÔNG cần dựng quan hệ.** Khởi tố và nhập-vụ-khác hàm ý một hồ sơ khác ở
 *    bảng khác; gán trạng thái mà không dựng liên kết là để hệ thống nói "đã khởi tố" mà không
 *    chỉ ra được vụ án nào. Hai nhóm ấy để lại, liệt kê riêng cho cán bộ rà tay.
 * 3. **Ghi sổ TỪNG hồ sơ**, kèm STT hệ cũ và nguyên văn câu chữ. Sổ ấy vừa là dấu vết đảo ngược
 *    được, vừa chính là danh sách để đưa khách hàng xác nhận.
 */

/** Nhóm gán được ngay: không đụng tới quan hệ giữa các bảng. */
const AP_DUOC: TrangThaiSuy[] = [
  'TAM_DINH_CHI',
  'KHONG_KHOI_TO',
  'TRA_DON',
  'LUU_DON',
  'HUONG_DAN',
  'PHAN_LOAI_DAN_SU',
  'DA_CHUYEN_DON_VI',
  'DA_GIAI_QUYET',
];

/**
 * Trạng thái đích cho từng thực thể.
 *
 * `null` nghĩa là thực thể ấy KHÔNG có chỗ chứa trạng thái ấy — bỏ qua, đừng ép vào một giá trị
 * gần đúng. "Trả đơn" ép thành "đã giải quyết" là nói sai với người đọc báo cáo.
 */
const DICH: Record<TrangThaiSuy, { don_thu: string | null; vu_viec: string | null; vu_an: string | null }> = {
  TAM_DINH_CHI: {
    don_thu: PetitionStatus.TAM_DINH_CHI,
    vu_viec: IncidentStatus.TAM_DINH_CHI,
    vu_an: CaseStatus.TAM_DINH_CHI,
  },
  KHONG_KHOI_TO: {
    don_thu: PetitionStatus.KHONG_KHOI_TO,
    vu_viec: IncidentStatus.KHONG_KHOI_TO,
    vu_an: null,
  },
  TRA_DON: { don_thu: PetitionStatus.DA_TRA_DON, vu_viec: null, vu_an: null },
  LUU_DON: { don_thu: PetitionStatus.DA_LUU_DON, vu_viec: null, vu_an: null },
  HUONG_DAN: { don_thu: PetitionStatus.DA_HUONG_DAN, vu_viec: null, vu_an: null },
  PHAN_LOAI_DAN_SU: {
    don_thu: PetitionStatus.PHAN_LOAI_DAN_SU,
    vu_viec: IncidentStatus.PHAN_LOAI_DAN_SU,
    vu_an: null,
  },
  DA_CHUYEN_DON_VI: {
    don_thu: PetitionStatus.DA_CHUYEN_DON_VI,
    vu_viec: IncidentStatus.DA_CHUYEN_DON_VI,
    vu_an: CaseStatus.DA_CHUYEN_DON_VI,
  },
  DA_GIAI_QUYET: {
    don_thu: PetitionStatus.DA_GIAI_QUYET,
    vu_viec: IncidentStatus.DA_GIAI_QUYET,
    vu_an: CaseStatus.DA_KET_LUAN,
  },
  // Hai nhóm dưới CỐ Ý không có đích: chúng hàm ý một hồ sơ khác ở bảng khác.
  DA_KHOI_TO: { don_thu: null, vu_viec: null, vu_an: null },
  DA_NHAP_VU_KHAC: { don_thu: null, vu_viec: null, vu_an: null },
};

export type ThucThe = 'don_thu' | 'vu_viec' | 'vu_an';

export interface DongSo {
  thucThe: ThucThe;
  hoSoId: string;
  legacyId: number | null;
  sttCu: string | null;
  namCu: string | null;
  maHoSo: string | null;
  trangThaiCu: string;
  trangThaiMoi: string;
  ngaySuy: Date | null;
  nguyenVan: string;
}

export interface KetQuaChay {
  runId: string;
  daApDung: boolean;
  ap: DongSo[];
  /** Suy được nhưng CỐ Ý không gán, kèm lý do — để cán bộ rà tay. */
  deLai: Array<{ thucThe: ThucThe; sttCu: string | null; trangThai: string; lyDo: string; nguyenVan: string }>;
  /** Không suy được hoặc nhập nhằng. */
  khongSuy: Array<{ thucThe: ThucThe; sttCu: string | null; ly: string; khop: string[]; nguyenVan: string }>;
}

interface HoSo {
  id: string;
  status: string;
  legacyId: number | null;
  legacyRaw: unknown;
  ma: string | null;
  ngayGiaiQuyet: Date | null;
}

function chuKetQua(raw: unknown): string {
  const r = raw as Record<string, unknown> | null;
  const v = r?.['ket_qua_xu_ly_giai_quyet_khac'];
  return typeof v === 'string' ? v : '';
}

/**
 * Đọc một khoá của bản ghi hệ cũ về dạng chuỗi.
 *
 * Nhận CẢ SỐ. `stt` và `nam` nằm trong JSON dưới dạng số, nên bản đầu chỉ nhận `string` đã trả
 * `null` cho cả 46.580 hồ sơ — và hai cột ấy chính là khoá để khách hàng đối chiếu. Danh sách
 * xuất ra vẫn "chạy đúng", chỉ là hai cột quan trọng nhất trống trơn.
 */
function lay(raw: unknown, khoa: string): string | null {
  const r = raw as Record<string, unknown> | null;
  const v = r?.[khoa];
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export async function chay(prisma: PrismaClient, apDung: boolean): Promise<KetQuaChay> {
  const runId = randomUUID();
  const kq: KetQuaChay = { runId, daApDung: apDung, ap: [], deLai: [], khongSuy: [] };

  const nguon: Array<{ thucThe: ThucThe; rows: HoSo[] }> = [
    {
      thucThe: 'don_thu',
      rows: (await prisma.petition.findMany({
        where: { deletedAt: null },
        select: { id: true, status: true, legacyId: true, legacyRaw: true, stt: true, ngayGiaiQuyet: true },
      })).map((r) => ({ ...r, ma: r.stt })),
    },
    {
      thucThe: 'vu_viec',
      rows: (await prisma.incident.findMany({
        where: { deletedAt: null },
        select: { id: true, status: true, legacyId: true, legacyRaw: true, code: true, ngayGiaiQuyet: true },
      })).map((r) => ({ ...r, ma: r.code })),
    },
    {
      thucThe: 'vu_an',
      rows: (await prisma.case.findMany({
        where: { deletedAt: null },
        select: { id: true, status: true, legacyId: true, legacyRaw: true, caseCode: true, ngayGiaiQuyet: true },
      })).map((r) => ({ ...r, ma: r.caseCode })),
    },
  ];

  for (const { thucThe, rows } of nguon) {
    for (const r of rows) {
      const chu = chuKetQua(r.legacyRaw);
      if (!chu.trim()) continue;

      const suy = suyTrangThai(chu);
      const sttCu = lay(r.legacyRaw, 'stt');
      const namCu = lay(r.legacyRaw, 'nam');

      if (suy.ly !== 'RO_RANG' || !suy.trangThai) {
        kq.khongSuy.push({ thucThe, sttCu, ly: suy.ly, khop: suy.khop, nguyenVan: chu });
        continue;
      }

      if (!AP_DUOC.includes(suy.trangThai)) {
        kq.deLai.push({
          thucThe,
          sttCu,
          trangThai: suy.trangThai,
          lyDo: 'Hàm ý một hồ sơ khác ở bảng khác — phải dựng liên kết, không chỉ đổi trạng thái.',
          nguyenVan: chu,
        });
        continue;
      }

      const dich = DICH[suy.trangThai][thucThe];
      if (!dich) {
        kq.deLai.push({
          thucThe,
          sttCu,
          trangThai: suy.trangThai,
          lyDo: `Thực thể ${thucThe} không có trạng thái tương ứng — không ép vào giá trị gần đúng.`,
          nguyenVan: chu,
        });
        continue;
      }

      // Hồ sơ đã rời khỏi trạng thái ban đầu thì KHÔNG đụng: cán bộ đã xử lý trên hệ mới, phán
      // đoán từ chữ hệ cũ không được đè lên việc người thật vừa làm.
      const conNguyenSo =
        (thucThe === 'don_thu' && r.status === PetitionStatus.MOI_TIEP_NHAN) ||
        (thucThe !== 'don_thu' && r.status === 'TIEP_NHAN');
      if (!conNguyenSo) continue;

      kq.ap.push({
        thucThe,
        hoSoId: r.id,
        legacyId: r.legacyId,
        sttCu,
        namCu,
        maHoSo: r.ma,
        trangThaiCu: r.status,
        trangThaiMoi: dich,
        ngaySuy: suy.ngay,
        nguyenVan: chu,
      });
    }
  }

  await prisma.legacyStatusInference.createMany({
    data: kq.ap.map((d) => ({ runId, daApDung: apDung, ...d })),
  });

  if (apDung) {
    for (const d of kq.ap) {
      // Mốc giải quyết chỉ đặt khi câu chữ CÓ ghi ngày và trạng thái là kết thúc. Không có ngày
      // thì để rỗng — bịa `now()` cho một hồ sơ đóng từ 2019 là đúng thứ cả đợt này đi sửa.
      const moc = d.ngaySuy && d.trangThaiMoi !== 'TAM_DINH_CHI' ? { ngayGiaiQuyet: d.ngaySuy } : {};
      const data = { status: d.trangThaiMoi as never, ...moc };
      if (d.thucThe === 'don_thu') await prisma.petition.update({ where: { id: d.hoSoId }, data });
      else if (d.thucThe === 'vu_viec') await prisma.incident.update({ where: { id: d.hoSoId }, data });
      else await prisma.case.update({ where: { id: d.hoSoId }, data });
    }
  }

  return kq;
}
