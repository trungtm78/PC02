/**
 * Form SỬA vụ án: tab ĐTBS và Vật chứng chỉ chứa mục THÊM MỚI trong lần sửa này (form không nạp mục cũ vào tab;
 * máy chủ ghi các mục ấy là mục THÊM — PUT /cases/:id từ 19/09/2026).
 *
 * Không nói ra thì cán bộ mở hồ sơ đã có ba bị can, thấy tab trống và tưởng dữ liệu mất — hoặc thêm lại lần nữa.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TabSubjects, TabEvidence } from '../tabs';
import { INITIAL_FORM_DATA } from '../types';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })) } }));
vi.mock('../LegacyTabBody', () => ({
  LegacyTabBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../DTBSTable', () => ({ DTBSTable: () => null }));
vi.mock('@/components/shared', () => ({
  Card: ({ children, ...p }: { children: React.ReactNode }) => <div {...p}>{children}</div>,
  CardHeader: ({ title }: { title: string }) => <h2>{title}</h2>,
  EmptyState: ({ message }: { message: string }) => <p>{message}</p>,
  DataTable: ({ emptyState }: { emptyState: React.ReactNode }) => <div>{emptyState}</div>,
  ActionButtons: () => null,
  StatusBadge: () => null,
}));

const chung = {
  formData: INITIAL_FORM_DATA,
  setFormData: vi.fn(),
  errors: {},
  setErrors: vi.fn(),
  onAdd: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
};

describe('Form sửa vụ án — tab mục con nói rõ đây là mục THÊM MỚI', () => {
  it('ĐTBS: chế độ sửa hiện ghi chú, chế độ tạo thì không', () => {
    const { unmount } = render(<TabSubjects {...chung} subjects={[]} caseId="c1" cheDoSua />);
    expect(screen.getByTestId('ghi-chu-muc-them-moi')).toHaveTextContent(/thêm mới trong lần sửa này/i);
    expect(screen.getByTestId('ghi-chu-muc-them-moi')).toHaveTextContent(/trang chi tiết vụ án/i);
    unmount();
    render(<TabSubjects {...chung} subjects={[]} />);
    expect(screen.queryByTestId('ghi-chu-muc-them-moi')).toBeNull();
  });

  it('Vật chứng: chế độ sửa hiện ghi chú, chế độ tạo thì không', () => {
    const { unmount } = render(<TabEvidence {...chung} evidences={[]} cheDoSua />);
    expect(screen.getByTestId('ghi-chu-muc-them-moi')).toHaveTextContent(/thêm mới trong lần sửa này/i);
    unmount();
    render(<TabEvidence {...chung} evidences={[]} />);
    expect(screen.queryByTestId('ghi-chu-muc-them-moi')).toBeNull();
  });
});
