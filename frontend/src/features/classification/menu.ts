import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

export const classificationMenu: FeatureMenuEntry[] = [
  {
    section: 'workflow',
    id: 'classification',
    label: 'Phân loại & Quản lý',
    icon: 'FolderKanban',
    children: [
      // v0.37.1: 3 items lạc chỗ moved to correct entity menus (cases, incidents, petitions).
      // Routes unchanged — only menu position. Bookmarks won't break.
      { section: 'workflow', id: 'classification-prosecutor', label: 'Đề xuất VKS', path: '/prosecutor-proposal', quyen: ['read:Case'] },
      // "Phân loại khác" gỡ 18/09/2026: hệ cũ (`Modules/PhanLoaiKhac`) lọc `ho_so_doi_1.loai =
      // "phan_loai_khac"` và Mongo hệ cũ đếm được 0 bản; hệ mới không có chỗ lưu loại hồ sơ ấy, nên màn
      // chỉ hiện mọi vụ án với cột "phân loại" = tội danh. Bật lại khi dựng loại hồ sơ thật.
    ],
  },
];
