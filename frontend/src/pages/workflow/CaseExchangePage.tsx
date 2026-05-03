/**
 * CaseExchangePage — Trao đổi chuyên án (SCR-PF-03)
 * TASK-ID: TASK-2026-260216
 *
 * REFS-FIRST: Adapted from C:/PC02/Refs/src/app/pages/CaseExchange.tsx
 * data-testid added for E2E/UAT automation per OPENCODE_QA_GATE.
 * EC-01: File đính kèm > 10MB validation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  SlidersHorizontal,
  Download,
  RotateCcw,
  Plus,
  X,
  Calendar,
  Building2,
  Send,
  Paperclip,
  FileText,
  Clock,
  MessageSquare,
  Eye,
  User,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { authStore } from '@/stores/auth.store';
import { downloadCsv } from '@/lib/csv';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Exchange {
  id: string;
  stt: number;
  recordCode: string;
  recordType: 'Vụ án' | 'Vụ việc' | 'Đơn thư';
  senderUnit: string;
  receiverUnit: string;
  createdDate: string;
  createdTime: string;
  status: string;
  statusColor: string;
  messageCount: number;
  lastMessage: string;
  lastMessageTime: string;
  hasUnread: boolean;
}

interface Message {
  id: string;
  exchangeId: string;
  sender: string;
  senderUnit: string;
  content: string;
  timestamp: string;
  attachments?: Attachment[];
  isCurrentUser: boolean;
}

interface Attachment {
  id: string;
  name: string;
  size: string;
  type: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_MB = 10;

/**
 * Màn hình Trao đổi chuyên án — quản lý trao đổi thông tin giữa các đơn vị.
 * Chat modal với bong bóng tin nhắn trái/phải.
 * EC-01: Kiểm tra file đính kèm > 10MB.
 */
export default function CaseExchangePage() {
  const [quickSearch, setQuickSearch] = useState('');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedExchange, setSelectedExchange] = useState<Exchange | null>(null);
  const [showThreadModal, setShowThreadModal] = useState(false);

  const [advancedFilters, setAdvancedFilters] = useState({
    recordCode: '',
    senderUnit: '',
    receiverUnit: '',
    status: '',
    fromDate: '',
    toDate: '',
  });

  // ── Real data state ────────────────────────────────────────────────────────
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const fetchExchanges = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/exchanges?limit=100');
      const mapped: Exchange[] = (res.data.data ?? []).map((e: any, i: number) => ({
        id: e.id,
        stt: i + 1,
        recordCode: e.recordCode ?? '',
        recordType: (e.recordType ?? 'Vụ án') as any,
        senderUnit: e.senderUnit ?? '',
        receiverUnit: e.receiverUnit ?? '',
        createdDate: e.createdAt ? new Date(e.createdAt).toLocaleDateString('vi-VN') : '',
        createdTime: e.createdAt ? new Date(e.createdAt).toLocaleTimeString('vi-VN') : '',
        status: (e.status === 'OPEN' ? 'open' : e.status === 'CLOSED' ? 'closed' : 'pending') as any,
        statusColor: e.status === 'OPEN' ? 'text-green-600' : 'text-gray-600',
        messageCount: e.messageCount ?? 0,
        lastMessage: e.lastMessage ?? '',
        lastMessageTime: e.lastMessageTime ? new Date(e.lastMessageTime).toLocaleTimeString('vi-VN') : '',
        hasUnread: false,
      }));
      setExchanges(mapped);
    } catch {
      setExchanges([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMessages = useCallback(async (exchangeId: string) => {
    setLoadingMessages(true);
    try {
      const res = await api.get(`/exchanges/${exchangeId}/messages`);
      const authUser = authStore.getUser();
      const mapped: Message[] = (res.data.data ?? []).map((m: any) => ({
        id: m.id,
        exchangeId: m.exchangeId,
        sender: m.sender ? `${m.sender.firstName ?? ''} ${m.sender.lastName ?? ''}`.trim() || 'Ẩn danh' : 'Hệ thống',
        senderUnit: '',
        content: m.content,
        timestamp: m.createdAt ? new Date(m.createdAt).toLocaleString('vi-VN') : '',
        attachments: m.attachments ?? [],
        isCurrentUser: m.senderEmail === authUser?.email,
      }));
      setMessages(mapped);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => { fetchExchanges(); }, [fetchExchanges]);

  const filteredExchanges = exchanges.filter((exchange) => {
    const q = quickSearch.toLowerCase();
    return (
      exchange.recordCode.toLowerCase().includes(q) ||
      exchange.senderUnit.toLowerCase().includes(q) ||
      exchange.receiverUnit.toLowerCase().includes(q) ||
      exchange.lastMessage.toLowerCase().includes(q)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filteredExchanges.length / PAGE_SIZE));
  const displayedExchanges = filteredExchanges.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleViewThread = (exchange: Exchange) => {
    setSelectedExchange(exchange);
    setShowThreadModal(true);
    fetchMessages(exchange.id);
  };

  const handleCreateExchange = async (payload: { recordCode: string; recordType: string; receiverUnit: string; subject: string; content: string }) => {
    await api.post('/exchanges', payload);
    await fetchExchanges();
  };

  const handleSendMessage = async (exchangeId: string, content: string) => {
    await api.post(`/exchanges/${exchangeId}/messages`, { content });
    await fetchMessages(exchangeId);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Tiêu đề */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Trao đổi chuyên án</h1>
        <p className="text-slate-600 text-sm mt-1">
          Quản lý trao đổi thông tin và chuyển giao hồ sơ giữa các đơn vị
        </p>
      </div>

      {/* Thanh hành động */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              data-testid="create-exchange-btn"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              Tạo trao đổi mới
            </button>
            <button
              data-testid="advanced-search-btn"
              onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Tìm kiếm nâng cao
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              data-testid="export-excel-btn"
              onClick={() => {
                const headers = ['STT', 'Mã hồ sơ', 'Loại', 'Đơn vị gửi', 'Đơn vị nhận', 'Ngày tạo', 'Trạng thái', 'Số tin nhắn'];
                const rows = filteredExchanges.map((e, i) => [
                  i + 1, e.recordCode, e.recordType, e.senderUnit, e.receiverUnit,
                  e.createdDate, e.status, e.messageCount,
                ]);
                downloadCsv(rows, headers, `TraoDoiChuyenAn_${new Date().toISOString().slice(0, 10)}.csv`);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Xuất Excel
            </button>
            <button data-testid="refresh-btn" onClick={() => fetchExchanges()} className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tìm kiếm nhanh */}
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              data-testid="quick-search-input"
              type="text"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder="Tìm kiếm theo mã hồ sơ, đơn vị gửi/nhận, nội dung trao đổi..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Bộ lọc nâng cao */}
        {showAdvancedSearch && (
          <div className="mt-4 pt-4 border-t border-slate-200" data-testid="advanced-search-panel">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-slate-800 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                Bộ lọc nâng cao
              </h3>
              <button onClick={() => setShowAdvancedSearch(false)} className="p-1 hover:bg-slate-100 rounded transition-colors">
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Mã hồ sơ</label>
                <input type="text" value={advancedFilters.recordCode}
                  onChange={(e) => setAdvancedFilters({ ...advancedFilters, recordCode: e.target.value })}
                  placeholder="Mã hồ sơ"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Đơn vị gửi</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" value={advancedFilters.senderUnit}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, senderUnit: e.target.value })}
                    placeholder="Đơn vị gửi"
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Đơn vị nhận</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" value={advancedFilters.receiverUnit}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, receiverUnit: e.target.value })}
                    placeholder="Đơn vị nhận"
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Trạng thái</label>
                <select value={advancedFilters.status}
                  onChange={(e) => setAdvancedFilters({ ...advancedFilters, status: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                >
                  <option value="">Tất cả</option>
                  <option value="Đang trao đổi">Đang trao đổi</option>
                  <option value="Chờ phản hồi">Chờ phản hồi</option>
                  <option value="Hoàn thành">Hoàn thành</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Từ ngày</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="date" value={advancedFilters.fromDate}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, fromDate: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Đến ngày</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="date" value={advancedFilters.toDate}
                    onChange={(e) => setAdvancedFilters({ ...advancedFilters, toDate: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setAdvancedFilters({ recordCode: '', senderUnit: '', receiverUnit: '', status: '', fromDate: '', toDate: '' })}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm"
              >
                Xóa bộ lọc
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bảng dữ liệu */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="font-bold text-slate-800">Danh sách trao đổi</h2>
          <p className="text-sm text-slate-600 mt-1">
            {loading ? 'Đang tải...' : `Hiển thị ${filteredExchanges.length} / ${exchanges.length} trao đổi`}
          </p>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <span className="ml-3 text-slate-600">Đang tải dữ liệu...</span>
            </div>
          ) : (
            <table className="w-full" data-testid="exchange-table">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider w-20 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">Thao tác</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider w-16">STT</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Mã hồ sơ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Đơn vị gửi</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Đơn vị nhận</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Thời gian khởi tạo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Tin nhắn cuối</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Số tin nhắn</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {displayedExchanges.map((exchange) => (
                  <tr
                    key={exchange.id}
                    onClick={() => handleViewThread(exchange)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleViewThread(exchange); } }}
                    tabIndex={0}
                    className={`cursor-pointer transition-colors ${exchange.hasUnread ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-blue-50'}`}
                  >
                    <td
                      className="px-3 py-3 whitespace-nowrap sticky left-0 z-10 bg-white border-r border-slate-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        data-testid={`view-thread-${exchange.id}`}
                        onClick={() => handleViewThread(exchange)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Xem hội thoại"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700 font-medium">{exchange.stt}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          exchange.recordType === 'Vụ án' ? 'bg-red-100 text-red-700'
                            : exchange.recordType === 'Vụ việc' ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {exchange.recordType}
                        </span>
                        <span className="text-sm font-medium text-blue-600">{exchange.recordCode}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{exchange.senderUnit}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <div className="flex items-center gap-2">
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                        {exchange.receiverUnit}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">
                      <div className="flex flex-col">
                        <span>{exchange.createdDate}</span>
                        <span className="text-xs text-slate-500">{exchange.createdTime}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-700 line-clamp-2 max-w-xs">{exchange.lastMessage}</p>
                      <span className="text-xs text-slate-500">{exchange.lastMessageTime}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                        <MessageSquare className="w-3 h-3" />
                        {exchange.messageCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1.5 rounded-md text-xs font-medium ${exchange.statusColor}`}>
                          {exchange.status}
                        </span>
                        {exchange.hasUnread && (
                          <span className="w-2 h-2 bg-blue-600 rounded-full" title="Có tin nhắn mới" />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Hiển thị <span className="font-medium">{filteredExchanges.length}</span> trên{' '}
            <span className="font-medium">{exchanges.length}</span> trao đổi
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Trước</button>
            <span className="px-4 py-2 text-sm font-medium text-slate-700">Trang {currentPage}/{totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Sau</button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateExchangeModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateExchange}
        />
      )}

      {showThreadModal && selectedExchange && (
        <ThreadModal
          exchange={selectedExchange}
          messages={messages}
          loadingMessages={loadingMessages}
          onClose={() => { setShowThreadModal(false); setSelectedExchange(null); setMessages([]); }}
          onSend={handleSendMessage}
        />
      )}
    </div>
  );
}

// ─── CreateExchangeModal ──────────────────────────────────────────────────────

function CreateExchangeModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (payload: { recordCode: string; recordType: string; receiverUnit: string; subject: string; content: string }) => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    recordCode: '',
    recordType: '',
    receiverUnit: '',
    subject: '',
    content: '',
    attachments: [] as File[],
  });
  const [errors, setErrors] = useState<{ recordCode?: string; receiverUnit?: string; content?: string; attachment?: string }>({});

  /** EC-01: Validate file size ≤ 10MB */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    const oversized = newFiles.find((f) => f.size > MAX_FILE_SIZE_MB * 1024 * 1024);
    if (oversized) {
      setErrors({ ...errors, attachment: `File "${oversized.name}" vượt quá ${MAX_FILE_SIZE_MB}MB. Vui lòng chọn file nhỏ hơn.` });
      return;
    }
    setErrors({ ...errors, attachment: undefined });
    setFormData({ ...formData, attachments: [...formData.attachments, ...newFiles] });
  };

  const handleRemoveFile = (index: number) => {
    setFormData({ ...formData, attachments: formData.attachments.filter((_, i) => i !== index) });
  };

  const handleSubmit = async () => {
    const newErrors: typeof errors = {};
    if (!formData.recordCode) newErrors.recordCode = 'Vui lòng nhập mã hồ sơ';
    if (!formData.receiverUnit) newErrors.receiverUnit = 'Vui lòng chọn đơn vị nhận';
    if (!formData.content) newErrors.content = 'Vui lòng nhập nội dung trao đổi';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    try {
      await onCreate({
        recordCode: formData.recordCode,
        recordType: formData.recordType,
        receiverUnit: formData.receiverUnit,
        subject: formData.subject,
        content: formData.content,
      });
      onClose();
    } catch {
      // keep modal open on error
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="exchange-modal">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold text-slate-800">Tạo trao đổi mới</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Mã hồ sơ <span className="text-red-500">*</span></label>
              <input
                data-testid="exchange-record-code-input"
                type="text"
                value={formData.recordCode}
                onChange={(e) => { setFormData({ ...formData, recordCode: e.target.value }); setErrors({ ...errors, recordCode: undefined }); }}
                className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 ${errors.recordCode ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'}`}
                placeholder="VD: VA-2026-001"
              />
              {errors.recordCode && <p className="text-xs text-red-600 mt-1">{errors.recordCode}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Loại hồ sơ</label>
              <select
                data-testid="exchange-record-type-select"
                value={formData.recordType}
                onChange={(e) => setFormData({ ...formData, recordType: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Chọn loại hồ sơ</option>
                <option value="Vụ án">Vụ án</option>
                <option value="Vụ việc">Vụ việc</option>
                <option value="Đơn thư">Đơn thư</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Đơn vị nhận <span className="text-red-500">*</span></label>
              <select
                data-testid="exchange-receiver-unit-select"
                value={formData.receiverUnit}
                onChange={(e) => { setFormData({ ...formData, receiverUnit: e.target.value }); setErrors({ ...errors, receiverUnit: undefined }); }}
                className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 bg-white ${errors.receiverUnit ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'}`}
              >
                <option value="">Chọn đơn vị nhận</option>
                <option value="Viện Kiểm sát Quận 1">Viện Kiểm sát Quận 1</option>
                <option value="Viện Kiểm sát Quận 3">Viện Kiểm sát Quận 3</option>
                <option value="Viện Kiểm sát Quận 5">Viện Kiểm sát Quận 5</option>
                <option value="Công an Thành phố">Công an Thành phố</option>
                <option value="Tòa án Nhân dân Quận 1">Tòa án Nhân dân Quận 1</option>
              </select>
              {errors.receiverUnit && <p className="text-xs text-red-600 mt-1">{errors.receiverUnit}</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Tiêu đề</label>
              <input
                data-testid="exchange-subject-input"
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Tiêu đề trao đổi"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Nội dung <span className="text-red-500">*</span></label>
              <textarea
                data-testid="exchange-content-textarea"
                value={formData.content}
                onChange={(e) => { setFormData({ ...formData, content: e.target.value }); setErrors({ ...errors, content: undefined }); }}
                rows={6}
                className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 ${errors.content ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'}`}
                placeholder="Nhập nội dung trao đổi..."
              />
              {errors.content && <p className="text-xs text-red-600 mt-1">{errors.content}</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">File đính kèm</label>
              {errors.attachment && (
                <div data-testid="attachment-error" className="flex items-center gap-2 mb-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-700">{errors.attachment}</p>
                </div>
              )}
              <div className="space-y-2">
                <label
                  data-testid="file-upload-label"
                  className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
                >
                  <Paperclip className="w-5 h-5 text-slate-400" />
                  <span className="text-sm text-slate-600">Chọn file đính kèm (tối đa {MAX_FILE_SIZE_MB}MB mỗi file)</span>
                  <input type="file" multiple onChange={handleFileChange} className="hidden" data-testid="file-input" />
                </label>
                {formData.attachments.length > 0 && (
                  <div className="space-y-2">
                    {formData.attachments.map((file, index) => (
                      <div key={index} className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded border border-slate-200">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span className="text-sm text-slate-700 truncate">{file.name}</span>
                          <span className="text-xs text-slate-500 flex-shrink-0">({(file.size / 1024).toFixed(1)} KB)</span>
                        </div>
                        <button onClick={() => handleRemoveFile(index)} className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">Hủy</button>
          <button
            data-testid="submit-exchange-btn"
            onClick={() => void handleSubmit()}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Tạo trao đổi
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ThreadModal ──────────────────────────────────────────────────────────────

function ThreadModal({
  exchange,
  messages,
  loadingMessages,
  onClose,
  onSend,
}: {
  exchange: Exchange;
  messages: Message[];
  loadingMessages: boolean;
  onClose: () => void;
  onSend: (exchangeId: string, content: string) => Promise<void>;
}) {
  const [newMessage, setNewMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  /** EC-01: Validate file size ≤ 10MB */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    const oversized = newFiles.find((f) => f.size > MAX_FILE_SIZE_MB * 1024 * 1024);
    if (oversized) {
      setAttachmentError(`File "${oversized.name}" vượt quá ${MAX_FILE_SIZE_MB}MB. Vui lòng chọn file nhỏ hơn.`);
      return;
    }
    setAttachmentError(null);
    setAttachments([...attachments, ...newFiles]);
  };

  const handleRemoveFile = (index: number) => setAttachments(attachments.filter((_, i) => i !== index));

  const handleSendMessage = async () => {
    if (!newMessage.trim()) {
      alert('Vui lòng nhập nội dung tin nhắn');
      return;
    }
    setSending(true);
    try {
      await onSend(exchange.id, newMessage.trim());
      setNewMessage('');
      setAttachments([]);
    } catch {
      // silently fail
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="thread-modal">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-bold text-slate-800">Trao đổi: {exchange.recordCode}</h2>
            <div className="flex items-center gap-4 mt-1 text-sm text-slate-600">
              <span className="flex items-center gap-1"><Building2 className="w-4 h-4" />{exchange.senderUnit}</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
              <span className="flex items-center gap-1"><Building2 className="w-4 h-4" />{exchange.receiverUnit}</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${exchange.statusColor}`}>{exchange.status}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
          {loadingMessages ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <span className="ml-3 text-slate-600">Đang tải tin nhắn...</span>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-2xl ${message.isCurrentUser ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200'} rounded-lg p-4 shadow-sm`}>
                    <div className={`flex items-center gap-2 mb-2 pb-2 border-b ${message.isCurrentUser ? 'border-blue-500' : 'border-slate-200'}`}>
                      <User className="w-4 h-4" />
                      <span className="text-sm font-medium">{message.sender}</span>
                      <span className={`text-xs ${message.isCurrentUser ? 'text-blue-100' : 'text-slate-500'}`}>({message.senderUnit})</span>
                    </div>
                    <p className={`text-sm whitespace-pre-wrap leading-relaxed ${message.isCurrentUser ? 'text-white' : 'text-slate-700'}`}>
                      {message.content}
                    </p>
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-blue-500 space-y-2">
                        {message.attachments.map((att) => (
                          <div key={att.id} className={`flex items-center gap-2 p-2 rounded ${message.isCurrentUser ? 'bg-blue-500' : 'bg-slate-50'}`}>
                            <FileText className="w-4 h-4" />
                            <span className="text-sm flex-1">{att.name}</span>
                            <span className="text-xs">{att.size}</span>
                            <button className="p-1 hover:bg-white/20 rounded" onClick={() => window.open(`/api/v1/documents/${att.id}/download`, '_blank')} title={`Tải ${att.name}`}><Download className="w-4 h-4" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className={`flex items-center gap-1 mt-2 text-xs ${message.isCurrentUser ? 'text-blue-100' : 'text-slate-500'}`}>
                      <Clock className="w-3 h-3" />
                      <span>{message.timestamp}</span>
                    </div>
                  </div>
                </div>
              ))}
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Chưa có tin nhắn nào</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-slate-200 p-4 flex-shrink-0 bg-white">
          {attachmentError && (
            <div data-testid="thread-attachment-error" className="mb-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700">{attachmentError}</p>
            </div>
          )}
          {attachments.length > 0 && (
            <div className="mb-3 space-y-2">
              {attachments.map((file, index) => (
                <div key={index} className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded border border-slate-200">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="text-sm text-slate-700 truncate">{file.name}</span>
                    <span className="text-xs text-slate-500 flex-shrink-0">({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button onClick={() => handleRemoveFile(index)} className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <label className="p-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
              <Paperclip className="w-5 h-5 text-slate-600" />
              <input type="file" multiple onChange={handleFileChange} className="hidden" data-testid="thread-file-input" />
            </label>
            <textarea
              data-testid="thread-message-input"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Nhập nội dung trả lời..."
              rows={3}
              className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <button
              data-testid="send-message-btn"
              onClick={() => void handleSendMessage()}
              disabled={sending}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              Gửi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
