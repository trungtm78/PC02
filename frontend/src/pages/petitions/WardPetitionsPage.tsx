/**
 * WardPetitionsPage — Đơn thư theo phường/xã
 *
 * v0.37.1: built to mirror WardCasesPage / WardIncidentsPage pattern so all 3 entities
 * (Vụ án, Vụ việc, Đơn thư) have a "theo phường/xã" filter view. Backend already
 * supports wardTeamId filter via QueryPetitionsDto (added v0.36.0.0).
 *
 * Minimal implementation — follows the same data flow as WardCasesPage but tailored
 * to Petition shape (STT, senderName, petitionType, status).
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RotateCcw, Eye, MapPin, Calendar, User, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { PetitionStatus } from '@/shared/enums/generated';
import { PETITION_STATUS_LABEL, PETITION_STATUS_BADGE, BADGE_DEFAULT } from '@/shared/enums/status-labels';
import { WardFilterDropdown } from '@/components/WardFilterDropdown';

interface PetitionRow {
  id: string;
  stt: string;
  senderName: string;
  petitionType?: string;
  receivedDate?: string;
  status: PetitionStatus;
  ward?: string;
  unit?: string;
}

export default function WardPetitionsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<PetitionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [wardTeamId, setWardTeamId] = useState<string>('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const params: Record<string, string> = { limit: '50' };
        if (wardTeamId) params.wardTeamId = wardTeamId;
        const resp = await api.get('/petitions', { params });
        setRows(resp.data?.data ?? resp.data ?? []);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [wardTeamId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.stt?.toLowerCase().includes(q) ||
        r.senderName?.toLowerCase().includes(q),
    );
  }, [rows, search]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            Đơn thư theo phường/xã
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Danh sách đơn thư filter theo địa bàn quản lý của tổ phường/xã (v0.36.0.0+ backend support).
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setSearch(''); setWardTeamId(''); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Đặt lại
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-gray-50 p-3 rounded-md">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Tìm theo STT hoặc người gửi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
        <WardFilterDropdown value={wardTeamId} onChange={setWardTeamId} />
      </div>

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-left text-xs text-gray-600">
              <th className="px-3 py-2 font-medium">STT</th>
              <th className="px-3 py-2 font-medium">Người gửi</th>
              <th className="px-3 py-2 font-medium">Loại đơn</th>
              <th className="px-3 py-2 font-medium">Ngày nhận</th>
              <th className="px-3 py-2 font-medium">Trạng thái</th>
              <th className="px-3 py-2 font-medium w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">Đang tải...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                Không có đơn thư trong phạm vi đã chọn.
              </td></tr>
            )}
            {!loading && filtered.map((r) => {
              const badge = PETITION_STATUS_BADGE[r.status as PetitionStatus] ?? BADGE_DEFAULT;
              const statusLabel = PETITION_STATUS_LABEL[r.status as PetitionStatus] ?? r.status;
              return (
                <tr key={r.id} className="hover:bg-blue-50">
                  <td className="px-3 py-2 font-mono text-xs">{r.stt}</td>
                  <td className="px-3 py-2 flex items-center gap-1.5">
                    <User className="w-3 h-3 text-gray-400" />
                    {r.senderName}
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {r.petitionType && (
                      <span className="inline-flex items-center gap-1 text-xs">
                        <FileText className="w-3 h-3" /> {r.petitionType}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {r.receivedDate && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(r.receivedDate).toLocaleDateString('vi-VN')}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${badge}`}>{statusLabel}</span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/petitions/${r.id}/edit`)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Xem chi tiết"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        Hiển thị {filtered.length} / {rows.length} bản ghi.
      </p>
    </div>
  );
}
