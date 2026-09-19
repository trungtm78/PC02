import { BadRequestException, Injectable } from '@nestjs/common';
import { CasesService } from '../cases/cases.service';
import { IncidentsService } from '../incidents/incidents.service';
import { PetitionsService } from '../petitions/petitions.service';
import type { DataScope } from '../auth/services/unit-scope.service';
import { QueryChuyenTraDto } from './dto/query-chuyen-tra.dto';
import {
  TRAN_GOP_MOI_NGUON,
  type DongChuyenTra,
  type LoaiHoSoChuyenTra,
} from './chuyen-tra.types';

interface HoSoTho {
  id: string;
  caseCode?: string | null;
  code?: string | null;
  stt?: string | null;
  name?: string | null;
  detailContent?: string | null;
  summary?: string | null;
  status: string;
  ngayDeXuat?: Date | null;
  sttSort?: number | null;
  assignedTeam?: { id?: string | null; name?: string | null } | null;
  investigator?: { firstName?: string | null; lastName?: string | null } | null;
  assignedTo?: { firstName?: string | null; lastName?: string | null } | null;
}

const hoTen = (
  n?: { firstName?: string | null; lastName?: string | null } | null,
) => (n ? `${n.lastName ?? ''} ${n.firstName ?? ''}`.trim() : '');

/**
 * Màn Chuyển đội / Trả hồ sơ gộp BA bảng (Vụ án, Vụ việc, Đơn thư).
 *
 * Gộp ở MÁY CHỦ chứ không ở trình duyệt vì hai lẽ đo được (18/09/2026):
 *   1. `limit` của ba endpoint bị chặn ở 100 — trình duyệt muốn gộp tới trang N phải xin N×20 dòng mỗi
 *      nguồn, nên từ trang 6 là 400 và cả màn trắng.
 *   2. Lấy K dòng đầu mỗi nguồn rồi sắp lại chỉ đúng khi nguồn và phép gộp dùng CÙNG khoá sắp; lệch khoá thì
 *      hồ sơ nằm ngoài K dòng đầu không bao giờ hiện, và dòng đã thấy ở trang 1 hiện lại ở trang 2 khi K tăng.
 *
 * Ở đây mỗi nguồn được hỏi với `sortBy=ngayDeXuat` — nguồn sắp `ngayDeXuat → sttSort → id` (`thenBy` của
 * `buildListOrderBy`, 19/09/2026) — và phép gộp sắp lại theo ĐÚNG ba khoá ấy, lấy tới hết trang đang xem,
 * nên phép gộp là chính xác. Vượt trần thì báo lỗi rõ thay vì trả trang thiếu.
 */
@Injectable()
export class WorkflowService {
  constructor(
    private readonly cases: CasesService,
    private readonly incidents: IncidentsService,
    private readonly petitions: PetitionsService,
  ) {}

  async listChuyenTra(query: QueryChuyenTraDto, dataScope?: DataScope | null) {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const denHetTrang = offset + limit;
    if (denHetTrang > TRAN_GOP_MOI_NGUON) {
      throw new BadRequestException(
        `Bảng gộp ba loại hồ sơ chỉ lật được tới ${TRAN_GOP_MOI_NGUON} dòng. Hãy thu hẹp bộ lọc (loại hồ sơ, khoảng ngày, từ khoá) thay vì lật tiếp.`,
      );
    }

    const chung = {
      search: query.search,
      tk: query.tk,
      limit: denHetTrang,
      offset: 0,
      sortBy: 'ngayDeXuat',
      sortOrder: 'desc' as const,
      thongKeTruongNgay: query.thongKeTruongNgay,
    };

    const nguon: Array<{
      loai: LoaiHoSoChuyenTra;
      chay: () => Promise<{ data: unknown[]; total: number }>;
    }> = [
      {
        loai: 'Vụ án',
        chay: () =>
          this.cases.getList(
            {
              ...chung,
              fromDate: query.fromDate,
              toDate: query.toDate,
            } as never,
            dataScope,
          ) as Promise<{ data: unknown[]; total: number }>,
      },
      {
        loai: 'Vụ việc',
        chay: () =>
          this.incidents.getList(
            {
              ...chung,
              // Vụ việc nhận khoảng ngày đề xuất qua tên tham số riêng.
              fromDateRange: query.fromDate,
              toDateRange: query.toDate,
            } as never,
            dataScope,
          ) as Promise<{ data: unknown[]; total: number }>,
      },
      {
        loai: 'Đơn thư',
        chay: () =>
          this.petitions.getList(
            {
              ...chung,
              fromDate: query.fromDate,
              toDate: query.toDate,
            } as never,
            dataScope,
          ) as Promise<{ data: unknown[]; total: number }>,
      },
    ];

    const canHoi = nguon.filter((n) => !query.loai || n.loai === query.loai);
    const ketQua = await Promise.all(
      canHoi.map(async (n) => {
        const trang = await n.chay();
        return {
          total: trang.total,
          dong: (trang.data as HoSoTho[]).map<DongChuyenTra>((r) => ({
            id: r.id,
            loai: n.loai,
            ma: r.caseCode ?? r.code ?? r.stt ?? null,
            ten: r.name ?? r.detailContent ?? r.summary ?? '',
            toId: r.assignedTeam?.id ?? null,
            toTen: r.assignedTeam?.name ?? '',
            nguoiPhuTrach: hoTen(r.investigator ?? r.assignedTo),
            ngayDeXuat: r.ngayDeXuat ?? null,
            sttSort: r.sttSort ?? null,
            trangThai: r.status,
          })),
        };
      }),
    );

    const moc = (d: DongChuyenTra) =>
      d.ngayDeXuat
        ? new Date(d.ngayDeXuat).getTime()
        : Number.NEGATIVE_INFINITY;
    const so = (d: DongChuyenTra) => d.sttSort ?? Number.NEGATIVE_INFINITY;
    const gop = ketQua
      .flatMap((k) => k.dong)
      // ĐÚNG ba khoá GIẢM DẦN của nguồn (`buildListOrderBy`: ngayDeXuat → sttSort → id, rỗng cuối). Lệch một
      // khoá là đảo thứ tự trong nhóm cùng ngày, mà phần đuôi nhóm ấy có thể chưa được lấy về — dòng nhảy trang.
      .sort(
        (a, b) => moc(b) - moc(a) || so(b) - so(a) || b.id.localeCompare(a.id),
      );

    return {
      data: gop.slice(offset, offset + limit),
      total: ketQua.reduce((n, k) => n + k.total, 0),
      /** Số dòng còn lật được — giao diện tắt nút sang trang khi chạm trần. */
      tranGop: TRAN_GOP_MOI_NGUON,
    };
  }
}
