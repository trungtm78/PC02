import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useColumnVisibility } from '../useColumnVisibility';
import type { ColumnDef } from '../Table';

/**
 * Bật/tắt cột kiểu treeview Odoo, lựa chọn lưu ở trình duyệt.
 *
 * Ba trạng thái mượn đúng ngữ nghĩa Odoo:
 *   không khai `optional` → luôn hiện, không vào menu (cột định danh)
 *   `optional: 'show'`   → vào menu, TÍCH SẴN
 *   `optional: 'hide'`   → vào menu, CHƯA TÍCH
 */
interface Row {
  id: string;
}

const COT: ColumnDef<Row>[] = [
  { key: 'actions', header: 'Thao tác', render: () => null },
  { key: 'stt', header: 'STT', render: () => null },
  { key: 'summary', header: 'Tóm tắt nội dung', optional: 'show', render: () => null },
  { key: 'status', header: 'Trạng thái', optional: 'show', render: () => null },
  { key: 'createdAt', header: 'Ngày tạo', optional: 'hide', render: () => null },
];

const KHOA = 'petitions_columns';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('useColumnVisibility', () => {
  it('mặc định: cột không khai optional luôn hiện, `show` hiện, `hide` ẩn', () => {
    const { result } = renderHook(() => useColumnVisibility('petitions', COT));

    expect(result.current.visibleColumns.map((c) => c.key)).toEqual([
      'actions',
      'stt',
      'summary',
      'status',
    ]);
  });

  it('menu CHỈ liệt kê cột optional — không cho tắt cột định danh', () => {
    const { result } = renderHook(() => useColumnVisibility('petitions', COT));

    // Thao tác và STT không được xuất hiện: tắt chúng đi thì cán bộ mất cả nút bấm lẫn mã hồ
    // sơ, không còn cách nào nhận ra dòng nào là dòng nào.
    expect(result.current.toggleableColumns.map((c) => c.key)).toEqual([
      'summary',
      'status',
      'createdAt',
    ]);
  });

  it('bỏ tích một cột → cột biến khỏi danh sách hiện', () => {
    const { result } = renderHook(() => useColumnVisibility('petitions', COT));

    act(() => result.current.toggle('status'));

    expect(result.current.visibleColumns.map((c) => c.key)).toEqual(['actions', 'stt', 'summary']);
  });

  it('tích lại → cột về ĐÚNG VỊ TRÍ CŨ, không nhảy xuống cuối', () => {
    // Thứ tự cột là thứ tự khai trong mã, không phải thứ tự người dùng bấm. Lưu một mảng
    // "cột đang hiện" theo thứ tự bấm là cách làm sai kinh điển của tính năng này.
    const { result } = renderHook(() => useColumnVisibility('petitions', COT));

    act(() => result.current.toggle('summary'));
    act(() => result.current.toggle('summary'));

    expect(result.current.visibleColumns.map((c) => c.key)).toEqual([
      'actions',
      'stt',
      'summary',
      'status',
    ]);
  });

  it('lựa chọn sống qua lần mở lại', () => {
    const { result, unmount } = renderHook(() => useColumnVisibility('petitions', COT));
    act(() => result.current.toggle('createdAt'));
    unmount();

    const lai = renderHook(() => useColumnVisibility('petitions', COT));
    expect(lai.result.current.visibleColumns.map((c) => c.key)).toContain('createdAt');
  });

  it('mỗi trang có khoá riêng — bật cột ở Đơn thư không đụng Vụ việc', () => {
    const a = renderHook(() => useColumnVisibility('petitions', COT));
    act(() => a.result.current.toggle('createdAt'));

    const b = renderHook(() => useColumnVisibility('incidents', COT));
    expect(b.result.current.visibleColumns.map((c) => c.key)).not.toContain('createdAt');
  });

  /**
   * `localStorage` KHÔNG chỉ trả rỗng — nó NÉM LỖI ở chế độ riêng tư và khi trình duyệt bị
   * đặt chặn dữ liệu trang. Không bọc thì cả trang danh sách trắng xoá, mà nguyên nhân nằm
   * ở một tính năng phụ là chọn cột. Đây là ca dễ bỏ nhất trong cả nhóm.
   */
  it('localStorage NÉM LỖI khi đọc → về mặc định, không vỡ trang', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });

    const { result } = renderHook(() => useColumnVisibility('petitions', COT));

    expect(result.current.visibleColumns.map((c) => c.key)).toEqual([
      'actions',
      'stt',
      'summary',
      'status',
    ]);
  });

  it('localStorage NÉM LỖI khi ghi → vẫn đổi được cột trong phiên, không vỡ', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    const { result } = renderHook(() => useColumnVisibility('petitions', COT));
    act(() => result.current.toggle('status'));

    expect(result.current.visibleColumns.map((c) => c.key)).not.toContain('status');
  });

  /**
   * LƯU THỨ NGƯỜI DÙNG ĐÃ ĐỔI, KHÔNG LƯU DANH SÁCH CỘT ĐANG HIỆN.
   *
   * Lúc đầu em định lưu thẳng danh sách cột đang hiện. Viết ca kiểm mới thấy mô hình ấy KHÔNG
   * trả lời được một câu: cột `status` vắng mặt trong khoá đã lưu nghĩa là "người dùng tắt
   * nó" hay "cột này thêm vào mã sau khi khoá được ghi"? Hai câu trả lời cho hai kết quả
   * ngược nhau, mà dữ liệu lưu thì y hệt.
   *
   * Lưu BẢN GHI ĐÈ (`{ khoá cột: hiện/ẩn }`) thì câu hỏi biến mất: có tên trong bản ghi là
   * người dùng đã đổi, không có tên là lấy theo `optional` khai trong mã.
   */
  it('khoá lưu chứa cột đã bị xoá khỏi mã → bỏ qua, cột còn lại vẫn đúng', () => {
    localStorage.setItem(KHOA, JSON.stringify({ summary: false, cot_da_xoa_tu_doi: true }));

    const { result } = renderHook(() => useColumnVisibility('petitions', COT));

    // `cot_da_xoa_tu_doi` không có định nghĩa cột → bỏ qua, không render cột ma.
    expect(result.current.visibleColumns.map((c) => c.key)).toEqual(['actions', 'stt', 'status']);
  });

  it('khoá lưu hỏng định dạng → về mặc định', () => {
    localStorage.setItem(KHOA, 'khong-phai-json');

    const { result } = renderHook(() => useColumnVisibility('petitions', COT));

    expect(result.current.visibleColumns.map((c) => c.key)).toEqual([
      'actions',
      'stt',
      'summary',
      'status',
    ]);
  });

  it('cột MỚI thêm vào mã sau này lấy theo optional, không coi là người dùng đã tắt', () => {
    // Khoá ghi từ trước, chưa từng biết tới cột `status`. Coi "không có tên trong khoá" là
    // "đã tắt" thì mọi cột thêm về sau sẽ ẩn với toàn bộ người dùng cũ, và không ai hiểu vì sao.
    localStorage.setItem(KHOA, JSON.stringify({ summary: false }));

    const { result } = renderHook(() => useColumnVisibility('petitions', COT));

    expect(result.current.visibleColumns.map((c) => c.key)).toContain('status');
  });
});
