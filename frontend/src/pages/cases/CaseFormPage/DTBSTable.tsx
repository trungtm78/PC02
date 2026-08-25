/**
 * Bảng "Danh sách điều tra bổ sung" — phần chính của tab ĐTBS ở hệ cũ.
 *
 * Năm cột dữ liệu của hệ cũ khai ở `DTBS_TABLE_COLUMNS` (đặc tả bố cục), bảng này chỉ dựng
 * theo. Ba mốc ngày (`ngayTiepNhanDTBS`, `ngayTraHoSoVKS`, `ngayTraHoSoToaAn`) là cột thật
 * trên `investigation_supplements`, không phải suy ra.
 *
 * Chỉ hoạt động ở chế độ SỬA: bản ghi điều tra bổ sung gắn với một vụ án đã tồn tại, chưa
 * lưu vụ án thì chưa có `caseId` để gắn. Ở chế độ Tạo mới, bảng nói rõ điều đó thay vì hiện
 * một bảng rỗng bấm gì cũng không được.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { formatVNDate } from "@/lib/dates";
import { DTBS_TABLE_COLUMNS } from "@/features/cases/legacy-form-layout.def";

interface Supplement {
  id: string;
  type: string;
  decisionNumber: string;
  decisionDate?: string | null;
  reason: string;
  ngayTiepNhanDTBS?: string | null;
  ngayTraHoSoVKS?: string | null;
  ngayTraHoSoToaAn?: string | null;
}

const O_TRONG: Omit<Supplement, "id"> = {
  type: "Điều tra bổ sung",
  decisionNumber: "",
  decisionDate: "",
  reason: "",
  ngayTiepNhanDTBS: "",
  ngayTraHoSoVKS: "",
  ngayTraHoSoToaAn: "",
};

const O_NHAP =
  "w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400";

export function DTBSTable({ caseId }: { caseId?: string }) {
  const qc = useQueryClient();
  const [dangThem, setDangThem] = useState(false);
  const [nhap, setNhap] = useState(O_TRONG);

  const { data, isLoading } = useQuery({
    queryKey: ["investigation-supplements", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const res = await api.get("/investigation-supplements", { params: { caseId } });
      return ((res.data as { data?: Supplement[] })?.data ?? []) as Supplement[];
    },
  });

  const themMoi = useMutation({
    mutationFn: async (v: Omit<Supplement, "id">) => {
      // Ô ngày để trống phải BỎ HẲN: máy chủ dùng `@IsOptional()`, mà `@IsOptional()` coi
      // chuỗi rỗng là có giá trị nên vẫn chạy tiếp `@IsDateString()` và trả 400.
      const body: Record<string, unknown> = { caseId, type: v.type, reason: v.reason, decisionNumber: v.decisionNumber };
      for (const k of ["decisionDate", "ngayTiepNhanDTBS", "ngayTraHoSoVKS", "ngayTraHoSoToaAn"] as const) {
        const t = (v[k] ?? "").toString().trim();
        if (t) body[k] = t;
      }
      await api.post("/investigation-supplements", body);
    },
    onSuccess: async () => {
      setNhap(O_TRONG);
      setDangThem(false);
      await qc.invalidateQueries({ queryKey: ["investigation-supplements", caseId] });
    },
  });

  const xoa = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/investigation-supplements/${id}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["investigation-supplements", caseId] });
    },
  });

  if (!caseId) {
    return (
      <div
        className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600"
        data-testid="dtbs-chua-luu"
      >
        <p className="font-medium text-slate-800">Danh sách điều tra bổ sung</p>
        <p className="mt-1">Lưu hồ sơ vụ án trước, rồi mở lại để thêm bản ghi điều tra bổ sung.</p>
      </div>
    );
  }

  const ds = data ?? [];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5" data-testid="dtbs-table">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-medium text-slate-800">Danh sách điều tra bổ sung</p>
        <button
          type="button"
          onClick={() => setDangThem((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          data-testid="dtbs-them"
        >
          <Plus className="h-4 w-4" />
          Thêm
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-600">
              {DTBS_TABLE_COLUMNS.map((c) => (
                <th key={c} className="px-2 py-2 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="px-2 py-3 text-slate-500" colSpan={DTBS_TABLE_COLUMNS.length}>
                  Đang tải…
                </td>
              </tr>
            )}
            {!isLoading && ds.length === 0 && !dangThem && (
              <tr>
                <td className="px-2 py-3 text-slate-500" colSpan={DTBS_TABLE_COLUMNS.length}>
                  Chưa có bản ghi điều tra bổ sung.
                </td>
              </tr>
            )}
            {ds.map((r, i) => (
              <tr key={r.id} className="border-b border-slate-100" data-testid={`dtbs-hang-${i}`}>
                <td className="px-2 py-2">{i + 1}</td>
                <td className="px-2 py-2">{r.ngayTiepNhanDTBS ? formatVNDate(r.ngayTiepNhanDTBS) : "—"}</td>
                <td className="px-2 py-2">{r.decisionNumber || "—"}</td>
                <td className="px-2 py-2">{r.ngayTraHoSoVKS ? formatVNDate(r.ngayTraHoSoVKS) : "—"}</td>
                <td className="px-2 py-2">{r.ngayTraHoSoToaAn ? formatVNDate(r.ngayTraHoSoToaAn) : "—"}</td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => xoa.mutate(r.id)}
                    className="rounded p-1 text-red-600 hover:bg-red-50"
                    title="Xóa"
                    data-testid={`dtbs-xoa-${i}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {dangThem && (
              <tr className="border-b border-slate-100 bg-blue-50/40" data-testid="dtbs-hang-moi">
                <td className="px-2 py-2 text-slate-500">mới</td>
                <td className="px-2 py-2">
                  <input
                    type="date"
                    className={O_NHAP}
                    aria-label="Ngày tiếp nhận án điều tra bổ sung"
                    value={nhap.ngayTiepNhanDTBS ?? ""}
                    onChange={(e) => setNhap({ ...nhap, ngayTiepNhanDTBS: e.target.value })}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    className={O_NHAP}
                    aria-label="Số Quyết định điều tra bổ sung"
                    value={nhap.decisionNumber}
                    onChange={(e) => setNhap({ ...nhap, decisionNumber: e.target.value })}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="date"
                    className={O_NHAP}
                    aria-label="Ngày trả hồ sơ điều tra bổ sung của Viện kiểm sát"
                    value={nhap.ngayTraHoSoVKS ?? ""}
                    onChange={(e) => setNhap({ ...nhap, ngayTraHoSoVKS: e.target.value })}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="date"
                    className={O_NHAP}
                    aria-label="Ngày trả hồ sơ điều tra bổ sung của Toà án"
                    value={nhap.ngayTraHoSoToaAn ?? ""}
                    onChange={(e) => setNhap({ ...nhap, ngayTraHoSoToaAn: e.target.value })}
                  />
                </td>
                <td className="px-2 py-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => themMoi.mutate(nhap)}
                      disabled={!nhap.decisionNumber.trim() || themMoi.isPending}
                      className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
                      data-testid="dtbs-xac-nhan"
                    >
                      Xác nhận
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNhap(O_TRONG);
                        setDangThem(false);
                      }}
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs"
                      data-testid="dtbs-huy"
                    >
                      Hủy
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {themMoi.isError && (
        <p className="mt-2 text-xs text-red-600" data-testid="dtbs-loi">
          Không thêm được bản ghi. Kiểm tra lại Số Quyết định điều tra bổ sung.
        </p>
      )}
    </div>
  );
}
