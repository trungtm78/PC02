import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  PrintDocumentsModalProvider,
  usePrintDocumentsModal,
} from '../PrintDocumentsModalProvider';

/**
 * Modal in chứng từ dùng chung — mở được từ một dòng danh sách.
 *
 * Modal thật tự gọi API lấy danh sách mẫu, nên ở đây thay bằng bản giả: thứ cần chốt là
 * PROVIDER truyền đúng thực thể và id xuống, không phải nội dung modal.
 */
vi.mock('@/features/document-templates/components/DynamicExportDocumentsModal', () => ({
  default: ({ entity, entityId }: { entity: string; entityId: string }) => (
    <div data-testid="modal-in">
      {entity}:{entityId}
    </div>
  ),
}));

function NutThu({ id = 'P1' }: { id?: string }) {
  const modal = usePrintDocumentsModal();
  return (
    <button type="button" onClick={() => modal.open({ entity: 'petitions', entityId: id })}>
      mở
    </button>
  );
}

function dungCay(id?: string) {
  return render(
    <PrintDocumentsModalProvider>
      <NutThu id={id} />
    </PrintDocumentsModalProvider>,
  );
}

describe('PrintDocumentsModalProvider', () => {
  it('chưa gọi open thì KHÔNG dựng modal', () => {
    // Dựng sẵn modal cho mọi dòng là gọi API xuất vài chục lần mỗi khi mở trang danh sách.
    dungCay();

    expect(screen.queryByTestId('modal-in')).not.toBeInTheDocument();
  });

  it('gọi open thì dựng modal với ĐÚNG thực thể và id', () => {
    dungCay('P42');

    fireEvent.click(screen.getByRole('button', { name: 'mở' }));

    expect(screen.getByTestId('modal-in')).toHaveTextContent('petitions:P42');
  });

  it('mở dòng khác thì modal đổi theo, không giữ id cũ', () => {
    // Một thể hiện duy nhất dùng lại cho mọi dòng, nên nếu không thay tham số thì cán bộ bấm
    // in dòng thứ hai lại ra chứng từ của dòng thứ nhất.
    function HaiNut() {
      const modal = usePrintDocumentsModal();
      return (
        <>
          <button type="button" onClick={() => modal.open({ entity: 'cases', entityId: 'C1' })}>
            một
          </button>
          <button type="button" onClick={() => modal.open({ entity: 'incidents', entityId: 'I2' })}>
            hai
          </button>
        </>
      );
    }
    render(
      <PrintDocumentsModalProvider>
        <HaiNut />
      </PrintDocumentsModalProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'một' }));
    expect(screen.getByTestId('modal-in')).toHaveTextContent('cases:C1');

    fireEvent.click(screen.getByRole('button', { name: 'hai' }));
    expect(screen.getByTestId('modal-in')).toHaveTextContent('incidents:I2');
  });

  it('dùng ngoài provider thì ném lỗi rõ ràng, không hỏng lặng lẽ', () => {
    const im = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<NutThu />)).toThrow(/PrintDocumentsModalProvider/);

    im.mockRestore();
  });
});
