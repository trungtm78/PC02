import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  DeleteResourceModalProvider,
  useDeleteResourceModal,
  type DeleteResourceType,
} from '../DeleteResourceModalProvider';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({ api: { delete: vi.fn() } }));
const mockApi = api as unknown as { delete: ReturnType<typeof vi.fn> };

/**
 * Máy chủ bắt buộc lý do khi xóa vụ án và vụ việc (`DeleteCaseDto` / `DeleteIncidentDto`,
 * 10–500 ký tự). Hộp thoại trước nay không hỏi lý do và gửi lệnh xóa rỗng, nên mọi lần xóa
 * đều trả 400 — cán bộ bấm Xóa, hộp thoại đóng lại, hồ sơ vẫn còn nguyên.
 *
 * Bắt được khi bấm thử trên máy thật 26/08/2026, không ca kiểm nào bắt được vì không ca nào
 * đối chiếu thân lời gọi với DTO của máy chủ.
 */

function Nut({ loai, id }: { loai: DeleteResourceType; id: string }) {
  const m = useDeleteResourceModal();
  return (
    <button data-testid="mo" onClick={() => m.open({ resourceType: loai, recordId: id })}>
      mở
    </button>
  );
}

function dung(loai: DeleteResourceType, id = 'X1') {
  return render(
    <DeleteResourceModalProvider>
      <Nut loai={loai} id={id} />
    </DeleteResourceModalProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.delete.mockResolvedValue({ data: {} });
});

describe('Xóa vụ án / vụ việc phải kèm lý do', () => {
  it.each(['cases', 'incidents'] as const)('%s: gửi kèm lý do trong thân lời gọi', async (loai) => {
    dung(loai, 'R9');
    fireEvent.click(screen.getByTestId('mo'));

    const o = screen.getByTestId('input-ly-do-xoa');
    fireEvent.change(o, { target: { value: 'Hồ sơ nhập trùng, đã có bản chính thức' } });
    fireEvent.click(screen.getByTestId('btn-confirm-delete'));

    await waitFor(() => expect(mockApi.delete).toHaveBeenCalled());
    expect(mockApi.delete).toHaveBeenCalledWith(`/${loai}/R9`, {
      data: { reason: 'Hồ sơ nhập trùng, đã có bản chính thức' },
    });
  });

  it('chưa đủ 10 ký tự thì không cho bấm Xóa — chặn tại chỗ thay vì để máy chủ trả 400', () => {
    dung('cases');
    fireEvent.click(screen.getByTestId('mo'));

    expect(screen.getByTestId('btn-confirm-delete')).toBeDisabled();
    fireEvent.change(screen.getByTestId('input-ly-do-xoa'), { target: { value: 'ngắn' } });
    expect(screen.getByTestId('btn-confirm-delete')).toBeDisabled();
    fireEvent.change(screen.getByTestId('input-ly-do-xoa'), {
      target: { value: 'Nhập nhầm đơn vị tiếp nhận' },
    });
    expect(screen.getByTestId('btn-confirm-delete')).not.toBeDisabled();
  });

  it('tài nguyên không đòi lý do thì không hiện ô, và gửi lệnh không kèm thân', async () => {
    dung('lawyers', 'L3');
    fireEvent.click(screen.getByTestId('mo'));

    expect(screen.queryByTestId('input-ly-do-xoa')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-confirm-delete'));
    await waitFor(() => expect(mockApi.delete).toHaveBeenCalledWith('/lawyers/L3'));
  });

  /**
   * Máy chủ xóa MỀM: bản ghi chỉ được đánh dấu, không mất khỏi cơ sở dữ liệu. Câu "không thể
   * hoàn tác" nói sai về hậu quả, và nói sai theo hướng làm cán bộ sợ không dám thao tác.
   */
  it('vụ án và vụ việc: không nói sai rằng thao tác không thể hoàn tác', () => {
    dung('cases');
    fireEvent.click(screen.getByTestId('mo'));
    expect(screen.queryByText(/không thể hoàn tác/i)).not.toBeInTheDocument();
  });
});
