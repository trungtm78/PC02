import { useState, useMemo } from 'react';
import { useBadgeCounts } from '../hooks/useBadgeCounts';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  Mail,
  AlertTriangle,
  ArrowRightLeft,
  MessageSquareText,
  MessagesSquare,
  Briefcase,
  FileCheck,
  MapPin,
  Gavel,
  Filter,
  Download,
  Activity,
  FileText,
  Calendar,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  Shield,
  Copy,
  Clock,
  TrendingUp,
  FileSpreadsheet,
  Scale,
  Database,
  Search,
  Star,
  X,
  List,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────── */

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path?: string;
  badge?: number | string;
  children?: MenuItem[];
}

interface MenuSection {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: MenuItem[];
}

/* ─── Menu Data (~30 routes from ModernSidebar) ──────────────── */

const menuSections: MenuSection[] = [
  {
    id: 'main',
    label: 'Tổng quan',
    icon: LayoutDashboard,
    items: [
      { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard, path: '/dashboard' },
    ],
  },
  {
    id: 'business',
    label: 'Nghiệp vụ chính',
    icon: Scale,
    items: [
      {
        id: 'cases',
        label: 'Quản lý vụ án',
        icon: FolderOpen,
        children: [
          { id: 'cases-list', label: 'Danh sách vụ án', icon: FileText, path: '/cases' },
          { id: 'add-new-record', label: 'Thêm mới hồ sơ', icon: FileText, path: '/add-new-record' },
          { id: 'comprehensive-list', label: 'Danh sách tổng hợp', icon: FileText, path: '/comprehensive-list' },
          { id: 'initial-cases', label: 'Vụ án/việc ban đầu', icon: FileText, path: '/initial-cases' },
        ],
      },
      {
        id: 'people',
        label: 'Quản lý đối tượng',
        icon: Users,
        children: [
          { id: 'suspects', label: 'Bị can / Bị cáo', icon: Shield, path: '/people/suspects' },
          { id: 'victims', label: 'Bị hại', icon: Users, path: '/people/victims' },
          { id: 'witnesses', label: 'Nhân chứng', icon: Users, path: '/people/witnesses' },
          { id: 'lawyers', label: 'Quản lý Luật sư', icon: Briefcase, path: '/lawyers' },
        ],
      },
      { id: 'petitions', label: 'Quản lý đơn thư', icon: Mail, path: '/petitions' },
      { id: 'incidents', label: 'Quản lý vụ việc', icon: AlertTriangle, path: '/incidents' },
    ],
  },
  {
    id: 'processing',
    label: 'Quy trình xử lý',
    icon: TrendingUp,
    items: [
      { id: 'transfer-return', label: 'Chuyển đổi & Trả HS', icon: ArrowRightLeft, path: '/transfer-return' },
      { id: 'guidance', label: 'Hướng dẫn đơn', icon: MessageSquareText, path: '/guidance' },
      { id: 'case-exchange', label: 'Trao đổi chuyên án', icon: MessagesSquare, path: '/case-exchange' },
      { id: 'investigation-delegation', label: 'Ủy thác điều tra', icon: FileCheck, path: '/investigation-delegation' },
    ],
  },
  {
    id: 'classification',
    label: 'Phân loại & Quản lý',
    icon: Filter,
    items: [
      {
        id: 'ward',
        label: 'Hồ sơ phường/xã',
        icon: MapPin,
        children: [
          { id: 'ward-incidents', label: 'Vụ việc phường/xã', icon: AlertTriangle, path: '/ward/incidents' },
          { id: 'ward-cases', label: 'Vụ án phường/xã', icon: Shield, path: '/ward/cases' },
        ],
      },
      { id: 'prosecutor-proposal', label: 'Kiến nghị VKS', icon: Gavel, path: '/prosecutor-proposal' },
      {
        id: 'classification-other',
        label: 'Phân loại khác',
        icon: Filter,
        children: [
          { id: 'classification-duplicates', label: 'Đơn trùng', icon: Copy, path: '/classification/duplicates' },
          { id: 'classification-others', label: 'Trường hợp khác', icon: FileText, path: '/classification/others' },
        ],
      },
    ],
  },
  {
    id: 'reports',
    label: 'Báo cáo & Thống kê',
    icon: BarChart3,
    items: [
      { id: 'export-reports', label: 'Xuất báo cáo', icon: Download, path: '/export-reports' },
      {
        id: 'statistics',
        label: 'Thống kê',
        icon: BarChart3,
        children: [
          { id: 'reports-monthly', label: 'Báo cáo tháng', icon: FileSpreadsheet, path: '/reports/monthly' },
          { id: 'reports-quarterly', label: 'Báo cáo quý', icon: FileSpreadsheet, path: '/reports/quarterly' },
          { id: 'statistics-district', label: 'Thống kê quận/huyện', icon: BarChart3, path: '/statistics/district' },
        ],
      },
      { id: 'overdue-records', label: 'Hồ sơ trễ hạn', icon: AlertTriangle, path: '/settings/overdue-records' },
      { id: 'activity-log', label: 'Nhật ký nghiệp vụ', icon: Activity, path: '/activity-log' },
    ],
  },
  {
    id: 'system',
    label: 'Hệ thống',
    icon: Settings,
    items: [
      { id: 'documents', label: 'Hồ sơ & Tài liệu', icon: FileText, path: '/documents' },
      { id: 'calendar', label: 'Lịch làm việc', icon: Calendar, path: '/calendar' },
      { id: 'directories', label: 'Danh mục', icon: Database, path: '/danh-muc' },
      { id: 'master-class', label: 'Phân loại danh mục', icon: List, path: '/phan-loai' },
      { id: 'users', label: 'Người dùng', icon: Users, path: '/nguoi-dung' },
      { id: 'settings', label: 'Cài đặt hệ thống', icon: Settings, path: '/settings' },
    ],
  },
];

/* ─── Component ──────────────────────────────────────────────── */

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { counts } = useBadgeCounts();

  // Map item id → live badge count from API
  const liveBadges: Record<string, number> = useMemo(
    () => ({
      'cases-list': counts.cases,
      suspects: counts.suspects,
      petitions: counts.petitions,
      incidents: counts.incidents,
      'overdue-records': counts.overdueRecords,
    }),
    [counts],
  );

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['main', 'business']),
  );
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(
    new Set(['cases', 'people']),
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<Set<string>>(new Set(['dashboard', 'cases-list']));
  const [isCompact, setIsCompact] = useState(false);
  const [recentItems] = useState<string[]>(['cases-list', 'petitions', 'export-reports']);
  const [showRemoveFavoriteModal, setShowRemoveFavoriteModal] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<{ id: string; label: string } | null>(null);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) { next.delete(sectionId); } else { next.add(sectionId); }
      return next;
    });
  };

  const toggleMenu = (menuId: string) => {
    setExpandedMenus((prev) => {
      const next = new Set(prev);
      if (next.has(menuId)) { next.delete(menuId); } else { next.add(menuId); }
      return next;
    });
  };

  const toggleFavorite = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) { next.delete(itemId); } else { next.add(itemId); }
      return next;
    });
  };

  const handleRemoveFavoriteClick = (item: MenuItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setItemToRemove({ id: item.id, label: item.label });
    setShowRemoveFavoriteModal(true);
  };

  const confirmRemoveFavorite = () => {
    if (itemToRemove) {
      setFavorites((prev) => {
        const next = new Set(prev);
        next.delete(itemToRemove.id);
        return next;
      });
      setShowRemoveFavoriteModal(false);
      setItemToRemove(null);
    }
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    return location.pathname === path;
  };

  const collapseAll = () => {
    setExpandedSections(new Set());
    setExpandedMenus(new Set());
  };

  const expandAll = () => {
    setExpandedSections(new Set(menuSections.map((s) => s.id)));
    const allMenuIds: string[] = [];
    menuSections.forEach((section) => {
      section.items.forEach((item) => {
        if (item.children) allMenuIds.push(item.id);
      });
    });
    setExpandedMenus(new Set(allMenuIds));
  };

  /* ── Search ──────────────────────────────────────────── */

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const results: Array<{ item: MenuItem; path: string; section: string }> = [];

    const searchInItems = (items: MenuItem[], sectionLabel: string, parentPath = '') => {
      items.forEach((item) => {
        const fullLabel = parentPath ? `${parentPath} > ${item.label}` : item.label;
        if (item.label.toLowerCase().includes(searchQuery.toLowerCase())) {
          results.push({ item, path: fullLabel, section: sectionLabel });
        }
        if (item.children) {
          searchInItems(item.children, sectionLabel, fullLabel);
        }
      });
    };

    menuSections.forEach((section) => {
      searchInItems(section.items, section.label);
    });
    return results;
  }, [searchQuery]);

  /* ── Favorites ───────────────────────────────────────── */

  const favoriteItems = useMemo(() => {
    const items: MenuItem[] = [];
    const findFavorites = (menuItems: MenuItem[]) => {
      menuItems.forEach((item) => {
        if (favorites.has(item.id)) items.push(item);
        if (item.children) findFavorites(item.children);
      });
    };
    menuSections.forEach((section) => findFavorites(section.items));
    return items;
  }, [favorites]);

  /* ── Render helpers ──────────────────────────────────── */

  const renderMenuItem = (item: MenuItem, level = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedMenus.has(item.id);
    const active = isActive(item.path);
    const isFavorite = favorites.has(item.id);
    const isRecent = recentItems.includes(item.id);
    const Icon = item.icon;
    const badgeCount = liveBadges[item.id] ?? item.badge;

    const paddingClass = level === 0 ? '' : level === 1 ? 'pl-6' : 'pl-10';

    return (
      <div key={item.id}>
        <button
          data-testid={`sidebar-item-${item.id}`}
          onClick={() => {
            if (hasChildren) {
              toggleMenu(item.id);
            } else if (item.path) {
              navigate(item.path);
            }
          }}
          className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-all group rounded ${
            isCompact ? 'justify-center' : ''
          } ${
            active
              ? 'bg-sidebar-primary text-white font-semibold shadow-sm'
              : 'text-white/90 hover:bg-white/10 hover:text-white'
          } ${paddingClass}`}
        >
          <Icon className={`flex-shrink-0 ${isCompact ? 'w-5 h-5' : 'w-4 h-4'}`} />

          {!isCompact && (
            <>
              <span className="flex-1 text-sm truncate">{item.label}</span>

              {!!badgeCount && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-secondary text-white">
                  {badgeCount}
                </span>
              )}

              {isRecent && !active && <Clock className="w-3 h-3 text-accent" />}

              {!hasChildren && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => toggleFavorite(item.id, e)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleFavorite(item.id, e as unknown as React.MouseEvent);
                    }
                  }}
                  className={`opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${
                    isFavorite ? 'opacity-100' : ''
                  }`}
                  aria-label={isFavorite ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
                >
                  <Star
                    className={`w-3.5 h-3.5 ${
                      isFavorite ? 'fill-accent text-accent' : 'text-white/40 hover:text-accent'
                    }`}
                  />
                </div>
              )}

              {hasChildren && (
                isExpanded
                  ? <ChevronDown className="w-4 h-4 opacity-70" />
                  : <ChevronRight className="w-4 h-4 opacity-70" />
              )}
            </>
          )}
        </button>

        {hasChildren && isExpanded && !isCompact && (
          <div className="bg-black/10 rounded-lg mt-1 mb-1">
            {item.children!.map((child) => renderMenuItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderSection = (section: MenuSection) => {
    const isExpanded = expandedSections.has(section.id);
    const SectionIcon = section.icon;

    return (
      <div key={section.id} className="mb-2">
        <button
          data-testid={`sidebar-section-${section.id}`}
          onClick={() => toggleSection(section.id)}
          className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider text-accent hover:text-accent/80 transition-colors rounded hover:bg-white/5 ${
            isCompact ? 'justify-center' : ''
          }`}
        >
          <SectionIcon className="w-4 h-4" />
          {!isCompact && (
            <>
              <span className="flex-1 text-left">{section.label}</span>
              {isExpanded
                ? <ChevronUp className="w-3.5 h-3.5" />
                : <ChevronDown className="w-3.5 h-3.5" />}
            </>
          )}
        </button>

        {isExpanded && (
          <div className="mt-1 space-y-0.5">
            {section.items.map((item) => renderMenuItem(item, 0))}
          </div>
        )}
      </div>
    );
  };

  /* ── Main Render ─────────────────────────────────────── */

  return (
    <aside
      data-testid="main-sidebar"
      style={isCompact ? { width: '64px', minWidth: '64px' } : { width: '260px', minWidth: '260px' }}
      className="bg-primary text-white border-r border-white/10 flex flex-col transition-all duration-300 shadow-xl"
    >
      {/* Header */}
      <div className="p-3 border-b border-white/10">
        {!isCompact && (
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
            <input
              data-testid="sidebar-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm menu..."
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-white/10 border border-white/20 text-white placeholder:text-white/50 rounded focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            data-testid="sidebar-toggle"
            onClick={() => setIsCompact(!isCompact)}
            className="p-1.5 hover:bg-white/10 rounded transition-colors"
            title={isCompact ? 'Mở rộng' : 'Thu gọn'}
          >
            <ChevronLeft
              className={`w-4 h-4 text-white/70 transition-transform ${isCompact ? 'rotate-180' : ''}`}
            />
          </button>

          {!isCompact && (
            <>
              <button
                onClick={collapseAll}
                className="flex-1 px-2 py-1 text-xs text-white/70 hover:bg-white/10 rounded transition-colors"
              >
                Thu gọn
              </button>
              <button
                onClick={expandAll}
                className="flex-1 px-2 py-1 text-xs text-white/70 hover:bg-white/10 rounded transition-colors"
              >
                Mở rộng
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search Results */}
      {searchResults && searchResults.length > 0 && !isCompact && (
        <div className="flex-1 overflow-y-auto p-2">
          <div className="text-xs font-medium text-white/50 mb-2 px-2">
            Kết quả ({searchResults.length})
          </div>
          {searchResults.map((result) => {
            const Icon = result.item.icon;
            return (
              <button
                key={result.item.id}
                onClick={() => {
                  if (result.item.path) navigate(result.item.path);
                  setSearchQuery('');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/10 rounded transition-colors mb-1 text-white/90"
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm truncate block">{result.item.label}</span>
                  <span className="text-xs text-white/40 truncate block">{result.section}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Favorites */}
      {!searchQuery && favoriteItems.length > 0 && !isCompact && (
        <div className="border-b border-white/10 p-2">
          <div className="flex items-center gap-1.5 px-2 mb-2">
            <Star className="w-3.5 h-3.5 fill-accent text-accent" />
            <span className="text-xs font-bold uppercase tracking-wider text-accent">
              Yêu thích
            </span>
          </div>
          {favoriteItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className={`group flex items-center gap-2 px-3 py-1.5 transition-all rounded-lg mb-0.5 ${
                  isActive(item.path)
                    ? 'bg-sidebar-primary text-white'
                    : 'text-white/90 hover:bg-white/10'
                }`}
              >
                <button
                  onClick={() => { if (item.path) navigate(item.path); }}
                  className="flex items-center gap-2 flex-1 text-left"
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm truncate">{item.label}</span>
                </button>
                <button
                  onClick={(e) => handleRemoveFavoriteClick(item, e)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-red-500/20 rounded"
                  title="Xóa khỏi yêu thích"
                >
                  <X className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Menu */}
      {!searchQuery && (
        <nav className="flex-1 overflow-y-auto p-2" data-testid="sidebar-nav">
          {menuSections.map((section) => renderSection(section))}
        </nav>
      )}

      {/* Footer */}
      {!isCompact && (
        <div className="p-3 border-t border-white/10 bg-black/20">
          <div className="text-xs text-white text-center">
            <p className="font-bold">PC02 - Quản lý vụ án</p>
            <p className="text-white/60 mt-0.5">Công an nhân dân · v2.0.0</p>
          </div>
        </div>
      )}

      {/* Remove Favorite Modal */}
      {showRemoveFavoriteModal && itemToRemove && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-800 mb-2">Xóa khỏi yêu thích</h3>
                  <p className="text-sm text-slate-600">
                    Bạn có chắc chắn muốn xóa{' '}
                    <strong>&quot;{itemToRemove.label}&quot;</strong> khỏi danh sách yêu thích?
                  </p>
                </div>
              </div>
            </div>
            <div className="border-t border-slate-200 p-4 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRemoveFavoriteModal(false);
                  setItemToRemove(null);
                }}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={confirmRemoveFavorite}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
