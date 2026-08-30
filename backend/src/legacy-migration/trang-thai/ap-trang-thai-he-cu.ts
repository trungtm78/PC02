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
/**
 * Nhóm gán được.
 *
 * Lượt đầu chỉ gán 8 nhóm không đụng quan hệ. Nay gán HẾT — anh chốt "làm toàn bộ, xác nhận
 * sau" — nhưng hai nhóm hàm ý hồ sơ khác vẫn được đánh dấu riêng trong danh sách, và được nối
 * liên kết ở chỗ tham chiếu khớp.
 */
const AP_DUOC: TrangThaiSuy[] = [
  'TAM_DINH_CHI',
  'KHONG_KHOI_TO',
  'TRA_DON',
  'LUU_DON',
  'HUONG_DAN',
  'PHAN_LOAI_DAN_SU',
  'DA_CHUYEN_DON_VI',
  'DA_GIAI_QUYET',
  'DA_KHOI_TO',
  'DA_NHAP_VU_KHAC',
  'DINH_CHI',
  'CHUYEN_XPHC',
  'DANG_XU_LY',
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
  /**
   * Hai nhóm dưới hàm ý một hồ sơ KHÁC ở bảng khác. Lượt đầu để lại hẳn; nay gán trạng thái
   * VÀ nối liên kết khi câu chữ có tham chiếu khớp đúng một hồ sơ.
   *
   * Đo được: 776/5.093 câu mang tham chiếu dạng `<stt>-<dd/mm/yyyy>`, trong đó 758 khớp một hồ
   * sơ có thật. Nối được 15% thì 15% ấy kiểm chứng được; 85% còn lại vẫn hơn hẳn việc để cả
   * 3.614 hồ sơ đứng ở "mới tiếp nhận" — miễn là danh sách nói rõ dòng nào có liên kết.
   */
  DA_KHOI_TO: {
    don_thu: PetitionStatus.DA_CHUYEN_VU_AN,
    vu_viec: IncidentStatus.DA_CHUYEN_VU_AN,
    // "Khởi tố" ghi trên một VỤ ÁN là mô tả chính nó, không phải một bước chuyển — vụ án đã
    // khởi tố thì đang trong giai đoạn điều tra.
    vu_an: CaseStatus.DANG_DIEU_TRA,
  },
  DA_NHAP_VU_KHAC: {
    don_thu: PetitionStatus.DA_NHAP_HO_SO_KHAC,
    vu_viec: IncidentStatus.DA_NHAP_VU_KHAC,
    vu_an: CaseStatus.DA_NHAP_VU_KHAC,
  },
  DINH_CHI: {
    don_thu: PetitionStatus.DINH_CHI,
    vu_viec: IncidentStatus.DINH_CHI,
    vu_an: CaseStatus.DINH_CHI,
  },
  CHUYEN_XPHC: {
    don_thu: PetitionStatus.CHUYEN_XPHC,
    vu_viec: IncidentStatus.CHUYEN_XPHC,
    vu_an: CaseStatus.CHUYEN_XPHC,
  },
  /**
   * "Đang xử lý" KHÔNG phải kết quả — nó chỉ nói hồ sơ đã được phân công. Vẫn gán, vì đứng ở
   * "mới tiếp nhận" trong khi đã có quyết định phân công cũng là sai; nhưng nó không bao giờ
   * thắng một kết quả thật (xem `UU_TIEN`).
   */
  DANG_XU_LY: {
    don_thu: PetitionStatus.DANG_XU_LY,
    vu_viec: IncidentStatus.DANG_XAC_MINH,
    vu_an: CaseStatus.DANG_XAC_MINH,
  },
};

export type ThucThe = 'don_thu' | 'vu_viec' | 'vu_an';

/**
 * Tham chiếu tới một hồ sơ khác, bóc từ câu chữ.
 *
 * Hệ cũ viết `1373-07/5/2019` — số thứ tự, gạch, rồi ngày. Ghép `<năm>-<stt>` ra đúng dạng mã
 * hồ sơ của hệ mới (xem quyết định "mã hồ sơ = năm-stt"). Đo được 776/5.093 câu có dạng này,
 * trong đó 758 khớp một hồ sơ có thật.
 */
const MAU_THAM_CHIEU = /(\d{1,5})\s*-\s*\d{1,2}\/\d{1,2}\/(\d{4})/;

export function maThamChieu(chu: string): string | null {
  const m = MAU_THAM_CHIEU.exec(chu);
  return m ? `${m[2]}-${m[1]}` : null;
}

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
  /** Suy từ câu khớp NHIỀU trạng thái — nhóm đáng soi kỹ nhất khi xác nhận. */
  nhieuNghia: boolean;
  /** Mã hồ sơ được nhắc tới trong câu, nếu khớp một hồ sơ có thật. */
  maLienKet: string | null;
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

      if (!suy.trangThai) {
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
        nhieuNghia: suy.ly === 'NHAP_NHANG',
        maLienKet: maThamChieu(chu),
      });
    }
  }

  await prisma.legacyStatusInference.createMany({
    data: kq.ap.map((d) => ({
      runId,
      daApDung: apDung,
      thucThe: d.thucThe,
      hoSoId: d.hoSoId,
      legacyId: d.legacyId,
      sttCu: d.sttCu,
      namCu: d.namCu,
      maHoSo: d.maHoSo,
      trangThaiCu: d.trangThaiCu,
      trangThaiMoi: d.trangThaiMoi,
      ngaySuy: d.ngaySuy,
      // Gắn cờ thẳng vào nguyên văn để sổ trong CSDL cũng đọc được, không phải chỉ tệp CSV.
      nguyenVan: `${d.nhieuNghia ? '[NHIỀU NGHĨA] ' : ''}${d.maLienKet ? `[→ ${d.maLienKet}] ` : ''}${d.nguyenVan}`,
    })),
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
