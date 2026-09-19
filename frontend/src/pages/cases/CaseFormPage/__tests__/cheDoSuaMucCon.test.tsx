/**
 * Form SỬA vụ án: tab ĐTBS và Vật chứng — bảng chỉ chứa mục THÊM MỚI trong lần sửa này (máy chủ ghi các mục gửi
 * lên là mục THÊM, PUT /cases/:id từ 19/09/2026), còn mục ĐÃ CÓ của vụ án hiện ở danh sách chỉ-xem phía trên.
 *
 * Rà mã độc lập 19/09/2026: bản đầu ghi chú "xem ở trang chi tiết" — nhưng trang chi tiết không có vật chứng và
 * không hiện nhân chứng; cán bộ tìm không thấy sẽ nhập lại → bản ghi TRÙNG. Nên mục đã có phải hiện ngay tại tab.
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

describe('Form sửa vụ án — tab mục con', () => {
  it('ĐTBS: chế độ sửa liệt kê đối tượng ĐÃ CÓ (chỉ xem) và nói rõ bảng là mục thêm mới', () => {
    render(
      <TabSubjects
        {...chung}
        subjects={[]}
        caseId="c1"
        cheDoSua
        mucDaCo={[{ id: 's1', chinh: 'Nguyễn Văn A', phu: 'Người làm chứng' }]}
      />,
    );
    const daCo = screen.getByTestId('muc-da-co');
    expect(daCo).toHaveTextContent('Đã có trong vụ án (1)');
    expect(daCo).toHaveTextContent('Nguyễn Văn A');
    expect(daCo).toHaveTextContent('Người làm chứng');
    const ghiChu = screen.getByTestId('ghi-chu-muc-them-moi');
    expect(ghiChu).toHaveTextContent(/thêm mới trong lần sửa này/i);
    expect(ghiChu).toHaveTextContent(/không cần nhập lại/i);
    expect(ghiChu).not.toHaveTextContent(/trang chi tiết/i);
  });

  it('Vật chứng: chế độ sửa liệt kê vật chứng ĐÃ CÓ', () => {
    render(
      <TabEvidence {...chung} evidences={[]} cheDoSua mucDaCo={[{ id: 'e1', chinh: 'VC-1 · Dao', phu: '1 cái' }]} />,
    );
    expect(screen.getByTestId('muc-da-co')).toHaveTextContent('VC-1 · Dao');
    expect(screen.getByTestId('ghi-chu-muc-them-moi')).toHaveTextContent(/thêm mới trong lần sửa này/i);
  });

  it('chế độ sửa, vụ án chưa có mục nào → nói rõ "chưa có", không để trống im lặng', () => {
    render(<TabEvidence {...chung} evidences={[]} cheDoSua mucDaCo={[]} />);
    expect(screen.getByTestId('muc-da-co')).toHaveTextContent('Đã có trong vụ án (0)');
  });

  it('chế độ tạo: không có danh sách đã có, không ghi chú', () => {
    render(<TabSubjects {...chung} subjects={[]} />);
    expect(screen.queryByTestId('muc-da-co')).toBeNull();
    expect(screen.queryByTestId('ghi-chu-muc-them-moi')).toBeNull();
  });
});

describe('Form sửa vụ án — tải danh sách đã có HỎNG khác RỖNG', () => {
  it('mucDaCo = null → nói rõ không tải được, không nói "chưa có"', () => {
    render(<TabEvidence {...chung} evidences={[]} cheDoSua mucDaCo={null} />);
    const daCo = screen.getByTestId('muc-da-co');
    expect(daCo).toHaveTextContent(/không tải được/i);
    expect(daCo).not.toHaveTextContent(/chưa có/i);
  });
});
