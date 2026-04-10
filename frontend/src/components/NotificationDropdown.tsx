/**
 * NotificationDropdown — Dropdown thông báo gắn vào bell icon trong MainLayout
 *
 * Features:
 * - Fetch notifications từ GET /notifications
 * - Hiển thị badge số chưa đọc trên bell icon
 * - Dropdown danh sách thông báo với icon theo loại
 * - Click vào thông báo → đánh dấu đã đọc + navigate đến link
 * - "Đánh dấu tất cả đã đọc" button
 * - "Xóa đã đọc" button
 * - Poll unread count mỗi 60 giây
 * - Auto-seed demo notifications nếu chưa có thông báo nào
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  X,
  CheckCheck,
  Trash2,
  AlertTriangle,
  FileText,
  Scale,
  Clock,
  Upload,
  Info,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

type NotificationType =
  | 'CASE_STATUS_CHANGED'
  | 'CASE_DEADLINE_NEAR'
  | 'CASE_ASSIGNED'
  | 'PETITION_RECEIVED'
  | 'PETITION_DEADLINE_NEAR'
  | 'DOCUMENT_UPLOADED'
  | 'SYSTEM';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
  readAt?: string;
}

interface NotificationListResponse {
  success: boolean;
  data: Notification[];
  total: number;
  unreadCount: number;
}

// ── Icon & color per type ─────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  NotificationType,
  { icon: React.ReactNode; bg: string; text: string }
> = {
  CASE_STATUS_CHANGED: {
    icon: <Scale className="w-4 h-4" />,
    bg: 'bg-blue-100',
    text: 'text-blue-600',
  },
  CASE_DEADLINE_NEAR: {
    icon: <Clock className="w-4 h-4" />,
    bg: 'bg-amber-100',
    text: 'text-amber-600',
  },
  CASE_ASSIGNED: {
    icon: <FileText className="w-4 h-4" />,
    bg: 'bg-purple-100',
    text: 'text-purple-600',
  },
  PETITION_RECEIVED: {
    icon: <FileText className="w-4 h-4" />,
    bg: 'bg-green-100',
    text: 'text-green-600',
  },
  PETITION_DEADLINE_NEAR: {
    icon: <AlertTriangle className="w-4 h-4" />,
    bg: 'bg-red-100',
    text: 'text-red-600',
  },
  DOCUMENT_UPLOADED: {
    icon: <Upload className="w-4 h-4" />,
    bg: 'bg-slate-100',
    text: 'text-slate-600',
  },
  SYSTEM: {
    icon: <Info className="w-4 h-4" />,
    bg: 'bg-slate-100',
    text: 'text-slate-600',
  },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NotificationDropdown() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [isDeletingRead, setIsDeletingRead] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Fetch notifications ─────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      // Seed demo data if this is first time
      await api.post('/notifications/seed').catch(() => {});

      const res = await api.get<NotificationListResponse>('/notifications', {
        params: { limit: 20 },
      });
      setNotifications(res.data.data ?? []);
      setUnreadCount(res.data.unreadCount ?? 0);
    } catch {
      // fail silently — don't break the layout
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Poll unread count every 60s ─────────────────────────────────────────────
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.get<{ unreadCount: number }>('/notifications/unread-count');
      setUnreadCount(res.data.unreadCount ?? 0);
    } catch {
      // fail silently
    }
  }, []);

  useEffect(() => {
    void fetchUnreadCount();
    const interval = setInterval(() => void fetchUnreadCount(), 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // ── Open / close dropdown ────────────────────────────────────────────────────
  const handleBellClick = () => {
    if (!open) {
      void fetchNotifications();
    }
    setOpen((v) => !v);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // ── Click notification ────────────────────────────────────────────────────────
  const handleNotificationClick = async (n: Notification) => {
    if (!n.isRead) {
      try {
        await api.patch(`/notifications/${n.id}/read`);
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // fail silently
      }
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  // ── Mark all read ──────────────────────────────────────────────────────────
  const handleMarkAllRead = async () => {
    setIsMarkingAll(true);
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // fail silently
    } finally {
      setIsMarkingAll(false);
    }
  };

  // ── Delete read notifications ─────────────────────────────────────────────
  const handleDeleteRead = async () => {
    setIsDeletingRead(true);
    try {
      await api.delete('/notifications/read');
      setNotifications((prev) => prev.filter((n) => !n.isRead));
    } catch {
      // fail silently
    } finally {
      setIsDeletingRead(false);
    }
  };

  // ── Delete one notification ───────────────────────────────────────────────
  const handleDeleteOne = async (e: React.MouseEvent, id: string, wasRead: boolean) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (!wasRead) setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // fail silently
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={handleBellClick}
        className="relative p-2 hover:bg-slate-100 rounded transition-colors"
        aria-label="Thông báo"
        data-testid="notification-bell"
      >
        <Bell className="w-5 h-5 text-slate-600" />
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 min-w-4 h-4 px-0.5 bg-secondary text-white text-xs rounded-full flex items-center justify-center font-bold leading-none"
            data-testid="notification-badge"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-96 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden"
          data-testid="notification-dropdown"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-slate-800 text-sm">Thông báo</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-secondary text-white text-xs rounded-full font-medium">
                  {unreadCount} chưa đọc
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={() => void handleMarkAllRead()}
                  disabled={isMarkingAll}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-primary hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                  title="Đánh dấu tất cả đã đọc"
                  data-testid="btn-mark-all-read"
                >
                  {isMarkingAll ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <CheckCheck className="w-3 h-3" />
                  )}
                  Đọc tất cả
                </button>
              )}
              <button
                onClick={() => void handleDeleteRead()}
                disabled={isDeletingRead || notifications.filter((n) => n.isRead).length === 0}
                className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded transition-colors disabled:opacity-30"
                title="Xóa thông báo đã đọc"
                data-testid="btn-delete-read"
              >
                {isDeletingRead ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
                Xóa đã đọc
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                <span className="ml-2 text-sm text-slate-500">Đang tải...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Bell className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm font-medium">Không có thông báo</p>
                <p className="text-xs mt-1">Mọi hoạt động sẽ hiển thị ở đây</p>
              </div>
            ) : (
              notifications.map((n) => {
                const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.SYSTEM;
                return (
                  <div
                    key={n.id}
                    onClick={() => void handleNotificationClick(n)}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors group ${
                      !n.isRead ? 'bg-blue-50/40' : ''
                    }`}
                    data-testid="notification-item"
                  >
                    {/* Type icon */}
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${cfg.bg} ${cfg.text}`}
                    >
                      {cfg.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-sm leading-snug ${
                            !n.isRead ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'
                          }`}
                        >
                          {n.title}
                        </p>
                        {/* Unread dot */}
                        {!n.isRead && (
                          <span className="flex-shrink-0 w-2 h-2 bg-primary rounded-full mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-xs text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>

                    {/* Delete button (visible on hover) */}
                    <button
                      onClick={(e) => void handleDeleteOne(e, n.id, n.isRead)}
                      className="flex-shrink-0 p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all mt-0.5"
                      title="Xóa thông báo này"
                      data-testid="btn-delete-notification"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-slate-200 px-4 py-2.5 bg-slate-50">
              <p className="text-xs text-slate-500 text-center">
                Hiển thị {notifications.length} thông báo gần nhất
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
