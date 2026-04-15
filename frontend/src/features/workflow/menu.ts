import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

export const workflowMenu: FeatureMenuEntry[] = [
  {
    section: 'workflow',
    id: 'workflow',
    label: 'Quy trình xử lý',
    icon: 'Workflow',
    children: [
      { section: 'workflow', id: 'workflow-transfer', label: 'Luân chuyển / Trả lại', path: '/transfer-return' },
      { section: 'workflow', id: 'workflow-guidance', label: 'Hướng dẫn nghiệp vụ', path: '/guidance' },
      { section: 'workflow', id: 'workflow-exchange', label: 'Trao đổi vụ án', path: '/case-exchange' },
      { section: 'workflow', id: 'workflow-delegation', label: 'Ủy quyền điều tra', path: '/investigation-delegation' },
    ],
  },
];
