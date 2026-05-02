import { useLocation } from 'react-router-dom';
import {
  FolderOpen,
  Mail,
  AlertTriangle,
  Settings,
  Activity,
  Construction,
  Users,
  Shield,
  FileText,
  ArrowRightLeft,
  MessageSquareText,
  MessagesSquare,
  FileCheck,
  MapPin,
  Gavel,
  Filter,
  Copy,
  Briefcase,
  Download,
  BarChart3,
  FileSpreadsheet,
  Calendar,
  Database,
} from 'lucide-react';

type ModuleInfo = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
};

const moduleMap: Record<string, ModuleInfo> = {
  /* ── Nghiệp vụ chính ─────────────────────────────── */
  '/cases': {
    label: 'Danh sách vụ án',
    icon: FolderOpen,
    description: 'Quản lý toàn bộ vụ án hình sự, theo dõi tiến trình điều tra.',
  },
  '/add-new-record': {
    label: 'Thêm mới hồ sơ',
    icon: FileText,
    description: 'Tạo hồ sơ vụ án mới, nhập thông tin ban đầu.',
  },
  '/comprehensive-list': {
    label: 'Danh sách tổng hợp',
    icon: FileText,
    description: 'Xem danh sách tổng hợp tất cả hồ sơ trong hệ thống.',
  },
  '/initial-cases': {
    label: 'Vụ án/việc ban đầu',
    icon: FileText,
    description: 'Quản lý các vụ án và vụ việc tiếp nhận ban đầu.',
  },
  '/people/suspects': {
    label: 'Bị can / Bị cáo',
    icon: Shield,
    description: 'Quản lý thông tin bị can, bị cáo liên quan đến các vụ án.',
  },
  '/people/victims': {
    label: 'Bị hại',
    icon: Users,
    description: 'Quản lý thông tin người bị hại trong các vụ án.',
  },
  '/people/witnesses': {
    label: 'Nhân chứng',
    icon: Users,
    description: 'Quản lý thông tin nhân chứng, người làm chứng.',
  },
  '/petitions': {
    label: 'Quản lý đơn thư',
    icon: Mail,
    description: 'Tiếp nhận, phân loại và xử lý đơn thư khiếu nại tố cáo.',
  },
  '/incidents': {
    label: 'Quản lý vụ việc',
    icon: AlertTriangle,
    description: 'Quản lý các vụ việc phát sinh, theo dõi và giải quyết.',
  },

  /* ── Quy trình xử lý ─────────────────────────────── */
  '/transfer-return': {
    label: 'Chuyển đổi & Trả HS',
    icon: ArrowRightLeft,
    description: 'Chuyển đổi hồ sơ giữa các đơn vị và trả hồ sơ.',
  },
  '/guidance': {
    label: 'Hướng dẫn đơn',
    icon: MessageSquareText,
    description: 'Quản lý hướng dẫn xử lý đơn thư cho các đơn vị.',
  },
  '/case-exchange': {
    label: 'Trao đổi chuyên án',
    icon: MessagesSquare,
    description: 'Trao đổi thông tin chuyên án giữa các cơ quan.',
  },
  '/investigation-delegation': {
    label: 'Ủy thác điều tra',
    icon: FileCheck,
    description: 'Quản lý ủy thác điều tra cho các đơn vị khác.',
  },

  /* ── Phân loại & Quản lý ──────────────────────────── */
  '/ward/incidents': {
    label: 'Vụ việc phường/xã',
    icon: MapPin,
    description: 'Quản lý vụ việc theo phường/xã trên địa bàn.',
  },
  '/ward/cases': {
    label: 'Vụ án phường/xã',
    icon: MapPin,
    description: 'Quản lý vụ án theo phường/xã trên địa bàn.',
  },
  '/prosecutor-proposal': {
    label: 'Kiến nghị VKS',
    icon: Gavel,
    description: 'Quản lý kiến nghị gửi Viện Kiểm sát.',
  },
  '/classification/duplicates': {
    label: 'Đơn trùng',
    icon: Copy,
    description: 'Phát hiện và xử lý các đơn thư trùng lặp.',
  },
  '/classification/others': {
    label: 'Trường hợp khác',
    icon: Filter,
    description: 'Phân loại và quản lý các trường hợp đặc biệt.',
  },
  '/lawyers': {
    label: 'Quản lý luật sư',
    icon: Briefcase,
    description: 'Quản lý thông tin luật sư tham gia trong vụ án.',
  },

  /* ── Báo cáo & Thống kê ──────────────────────────── */
  '/export-reports': {
    label: 'Xuất báo cáo',
    icon: Download,
    description: 'Xuất báo cáo tổng hợp theo các tiêu chí.',
  },
  '/reports/monthly': {
    label: 'Báo cáo tháng',
    icon: FileSpreadsheet,
    description: 'Xem và xuất báo cáo nghiệp vụ hàng tháng.',
  },
  '/reports/quarterly': {
    label: 'Báo cáo quý',
    icon: FileSpreadsheet,
    description: 'Xem và xuất báo cáo nghiệp vụ hàng quý.',
  },
  '/statistics/district': {
    label: 'Thống kê phường/xã',
    icon: BarChart3,
    description: 'Thống kê tình hình an ninh theo phường/xã.',
  },
  '/settings/overdue-records': {
    label: 'Hồ sơ trễ hạn',
    icon: AlertTriangle,
    description: 'Theo dõi các hồ sơ quá hạn xử lý.',
  },
  '/activity-log': {
    label: 'Nhật ký nghiệp vụ',
    icon: Activity,
    description: 'Xem nhật ký hoạt động nghiệp vụ.',
  },

  /* ── Hệ thống ─────────────────────────────────────── */
  '/documents': {
    label: 'Hồ sơ & Tài liệu',
    icon: FileText,
    description: 'Quản lý hồ sơ và tài liệu trong hệ thống.',
  },
  '/calendar': {
    label: 'Lịch làm việc',
    icon: Calendar,
    description: 'Quản lý lịch làm việc và sự kiện.',
  },
  '/settings': {
    label: 'Cài đặt hệ thống',
    icon: Settings,
    description: 'Cài đặt và cấu hình các tham số hệ thống.',
  },

  /* ── Legacy routes (backward compat) ──────────────── */
  '/danh-muc': {
    label: 'Danh mục',
    icon: Database,
    description: 'Quản lý danh mục dữ liệu hệ thống.',
  },
};

export default function ComingSoonPage() {
  const location = useLocation();
  const mod = moduleMap[location.pathname] ?? {
    label: 'Tính năng',
    icon: Construction,
    description: 'Tính năng này đang trong quá trình phát triển.',
  };

  const Icon = mod.icon;

  return (
    <div className="flex items-center justify-center min-h-full p-8">
      <div className="text-center max-w-md">
        {/* Icon container */}
        <div className="w-24 h-24 bg-[#003973]/10 border-2 border-[#003973]/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Icon className="w-12 h-12 text-[#003973]" />
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-full mb-4">
          <Construction className="w-4 h-4 text-[#F59E0B]" />
          <span className="text-sm font-medium text-[#F59E0B]">Sắp ra mắt</span>
        </div>

        <h1 data-testid="coming-soon-title" className="text-2xl font-bold text-[#003973] mb-3">
          Mô-đun {mod.label}
        </h1>
        <p className="text-slate-600 mb-8 leading-relaxed">{mod.description}</p>

        {/* Progress bar */}
        <div className="bg-slate-100 rounded-full h-2 mb-2 overflow-hidden">
          <div
            className="h-2 bg-gradient-to-r from-[#003973] to-[#F59E0B] rounded-full"
            style={{ width: '35%' }}
          />
        </div>
        <p className="text-xs text-slate-500">Tiến độ phát triển: 35%</p>

        <div className="mt-8 p-4 bg-slate-50 rounded-lg border border-slate-200 text-left">
          <p className="text-sm font-medium text-slate-700 mb-2">Tính năng sẽ bao gồm:</p>
          <ul className="text-sm text-slate-600 space-y-1">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#F59E0B] rounded-full" />
              Xem và tìm kiếm danh sách
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#F59E0B] rounded-full" />
              Thêm, sửa, xóa dữ liệu
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#F59E0B] rounded-full" />
              Xuất báo cáo Excel/PDF
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
