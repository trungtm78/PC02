import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import * as api from '../../api';
import { TemplateFormModal } from '../TemplateFormModal';

vi.mock('../../api');
vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: { listTemplates: vi.fn().mockResolvedValue([]) },
}));

const mApi = vi.mocked(api);

/**
 * Vị trí của hai công tắc cấp-mẫu trong form Sửa mẫu chứng từ.
 *
 * ── Vì sao có tệp này ──
 *
 * Ngày 29/08/2026 anh báo: "tạo mới có ô tích sẵn, nhưng bấm Sửa thì KHÔNG thấy ô đó đâu để
 * mà sửa". Chẩn đoán trên MÁY THẬT cho thấy ô vẫn có trong DOM, `isVisible` vẫn `true`, máy chủ
 * vẫn nhận `PATCH` 200 — **không có gì hỏng theo nghĩa mã sai**. Cái hỏng là chỗ đứng:
 *
 *   ô "Tích sẵn khi in" ở toạ độ y = 1408 trong màn hình cao 900.
 *
 * Nó nằm SAU khối khai biến. Khối ấy là phần **duy nhất dài không giới hạn** của form: mẫu này
 * có 21 dòng biến, mẫu khác có thể 40. Lúc TẠO MỚI chưa chọn tệp nên khối biến rỗng, hai công
 * tắc trôi lên ngay dưới ô tệp — thấy liền. Lúc SỬA thì 21 dòng biến đẩy chúng xuống dưới đáy.
 * Cùng một đoạn mã, hai trải nghiệm trái ngược, và người dùng kết luận "chức năng không có".
 *
 * ── Vì sao neo bằng THỨ TỰ chứ không bằng toạ độ ──
 *
 * jsdom không dựng bố cục nên `getBoundingClientRect` luôn trả 0 — ca kiểm đo toạ độ ở đây sẽ
 * xanh vĩnh viễn mà chẳng chứng minh gì. Thứ tự DOM mới là nguyên nhân gốc và là thứ jsdom
 * biết chắc: hễ thuộc tính-của-mẫu còn đứng sau danh sách biến thì lỗi này quay lại nguyên vẹn.
 *
 * Quy tắc rút ra: **mọi ô có số lượng cố định phải đứng trước ô lặp không giới hạn.**
 */
const TPL_NHIEU_BIEN = {
  id: 't9',
  code: 'QD_KT',
  name: 'QĐ khởi tố',
  entityType: 'VU_AN',
  category: 'Quyết định',
  fileName: 'qd.docx',
  fileSha: 'x',
  delimStart: '[[',
  delimEnd: ']]',
  // Đúng thứ dựng nên lỗi: nhiều dòng biến đẩy mọi thứ phía sau xuống khỏi tầm nhìn.
  variables: Array.from({ length: 21 }, (_, i) => ({
    name: `bien${i}`,
    source: 'auto' as const,
    label: `bien${i}`,
    field: `bien${i}`,
  })),
  needsNumber: false,
  numberSeriesId: null,
  status: 'active',
  sortOrder: 0,
  selectedByDefault: false,
} as const;

/**
 * Vị trí trong thứ tự duyệt tài liệu — số nhỏ hơn là đứng trước.
 *
 * NÉM khi không tìm thấy, không trả `-1`. Trả `-1` thì ô BIẾN MẤT cũng qua cổng, vì `-1` nhỏ
 * hơn mọi vị trí — tức cổng dựng ra để giữ ô lại sẽ xanh chính lúc ô bị xoá. Đây đúng kiểu
 * xanh giả nguy hiểm nhất: không ca nào đỏ, không cảnh báo nào hiện.
 */
function viTri(id: string): number {
  const moi = Array.from(document.querySelectorAll('[data-testid]'));
  const i = moi.findIndex((e) => e.getAttribute('data-testid') === id);
  if (i < 0) throw new Error(`không có ô "${id}" trong form — cổng thứ tự không so được`);
  return i;
}

beforeEach(() => {
  vi.clearAllMocks();
  mApi.getFieldCatalog.mockResolvedValue([]);
  mApi.detectVariables.mockResolvedValue({ detected: [], suggested: [] });
});

describe('Chỗ đứng của thuộc tính mẫu trong form', () => {
  it('mở form Sửa thì thấy đủ 21 dòng biến (dựng đúng bối cảnh gây lỗi)', async () => {
    render(<TemplateFormModal template={TPL_NHIEU_BIEN as never} onClose={vi.fn()} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('var-row-bien0')).toBeInTheDocument());
    expect(screen.getAllByTestId(/^var-row-/)).toHaveLength(21);
  });

  it('ô "Tích sẵn khi in" đứng TRƯỚC danh sách biến', async () => {
    render(<TemplateFormModal template={TPL_NHIEU_BIEN as never} onClose={vi.fn()} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('var-row-bien0')).toBeInTheDocument());
    expect(viTri('template-selected-by-default')).toBeLessThan(viTri('var-row-bien0'));
  });

  it('ô "Cấp số văn bản" đứng TRƯỚC danh sách biến', async () => {
    render(<TemplateFormModal template={TPL_NHIEU_BIEN as never} onClose={vi.fn()} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('var-row-bien0')).toBeInTheDocument());
    expect(viTri('template-needs-number')).toBeLessThan(viTri('var-row-bien0'));
  });

  it('ô "Thứ tự" đứng TRƯỚC danh sách biến', async () => {
    render(<TemplateFormModal template={TPL_NHIEU_BIEN as never} onClose={vi.fn()} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('var-row-bien0')).toBeInTheDocument());
    expect(viTri('template-sort-order')).toBeLessThan(viTri('var-row-bien0'));
  });

  /**
   * Nút Lưu cũng nằm sau khối biến. Với mẫu 21 biến, người dùng phải cuộn hết danh sách mới
   * bấm được — cùng một gốc rễ. Ghim thanh nút xuống đáy khung để nó luôn trong tầm với.
   */
  it('thanh nút Lưu được ghim đáy khung để luôn bấm được', async () => {
    render(<TemplateFormModal template={TPL_NHIEU_BIEN as never} onClose={vi.fn()} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('var-row-bien0')).toBeInTheDocument());
    const thanh = screen.getByTestId('btn-save-template').parentElement!;
    expect(thanh.className).toContain('sticky');
    expect(thanh.className).toContain('bottom-0');
  });

  /**
   * Chốt chặn lâu dài: KHÔNG ô cấp-mẫu nào được rơi xuống sau danh sách biến trong tương lai.
   * Ai thêm ô mới vào cuối form sẽ làm ca này đỏ, và đó chính là điều cần xảy ra.
   */
  it('mọi ô thuộc tính của mẫu đều đứng trước danh sách biến', async () => {
    render(<TemplateFormModal template={TPL_NHIEU_BIEN as never} onClose={vi.fn()} onSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('var-row-bien0')).toBeInTheDocument());
    const moc = viTri('var-row-bien0');
    for (const id of [
      // Sửa thì Loại hồ sơ khoá lại (CỐ Ý — đổi loại của mẫu đã dùng là đổi ý nghĩa hồ sơ đã
      // in), nên ô ở chế độ này là `template-entity-readonly`. Cổng nghiêm vừa bắt đúng chỗ
      // em khai nhầm ô chỉ tồn tại lúc tạo mới.
      'template-entity-readonly',
      'template-delim-preset',
      'template-file-input',
      'template-needs-number',
      'template-selected-by-default',
      'template-sort-order',
    ]) {
      expect(viTri(id), `ô "${id}" bị đẩy xuống sau danh sách biến`).toBeLessThan(moc);
    }
  });
});
