import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

export const dashboardMenu: FeatureMenuEntry[] = [
  {
    section: 'main',
    id: 'dashboard',
    // Mục cha đã tên "Tổng quan"; để mục lá cùng tên thì thanh bên hiện "Tổng quan / Tổng quan".
    // Không nguy hiểm như trường hợp NHÓM trùng tên (bấm vào lại thấy đúng cái tên vừa bấm, và
    // 13 màn nấp phía sau — xem `trungTenMuc` ở useMenuSections), nhưng vẫn là một dòng thừa,
    // và cổng chặn "không mục nào chứa mục con trùng tên chính nó" phải đúng cho MỌI mục thì
    // mới còn giá trị.
    label: 'Bảng điều khiển',
    path: '/dashboard',
    icon: 'LayoutDashboard',
  },
];
