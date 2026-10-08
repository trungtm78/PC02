import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CrimeSelect } from '../CrimeSelect';
import type { CrimeOption } from '../crime-select-utils';

Element.prototype.scrollIntoView = vi.fn();

const CRIMES: CrimeOption[] = [
  { id: 'a', code: 'D123', name: 'Tội giết người', pc02Relevant: true, articleNo: 123 },
  { id: 'b', code: 'D173', name: 'Tội trộm cắp tài sản', pc02Relevant: true, articleNo: 173 },
  { id: 'c', code: 'D251', name: 'Tội mua bán trái phép chất ma túy', pc02Relevant: false, articleNo: 251 },
];

vi.mock('@/hooks/useCrimeOptions', () => ({
  useCrimeOptions: () => ({ data: CRIMES, isLoading: false }),
}));

const trigger = () => screen.getByTestId('crime-select-trigger');
const search = () => screen.getByTestId('crime-select-search');

function moHop() {
  fireEvent.click(trigger());
}

describe('CrimeSelect — bàn phím', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('nút mở', () => {
    it('là <button> thật (Tab tới được, và <fieldset disabled> khoá được) với role combobox', () => {
      render(<CrimeSelect label="Tội danh" value="" onChange={() => {}} />);
      expect(trigger().tagName).toBe('BUTTON');
      expect(trigger().getAttribute('type')).toBe('button');
      expect(trigger().getAttribute('role')).toBe('combobox');
      expect(trigger().getAttribute('aria-expanded')).toBe('false');
      expect(trigger().getAttribute('aria-haspopup')).toBe('listbox');
    });

    it('tên của nút lấy từ NHÃN (aria-labelledby) để giá trị đang chọn vẫn được đọc, không bị aria-label đè', () => {
      render(<CrimeSelect label="Tội danh chính" value="b" onChange={() => {}} />);
      expect(trigger().hasAttribute('aria-label')).toBe(false);
      const nhan = document.getElementById(trigger().getAttribute('aria-labelledby') ?? '');
      expect(nhan?.textContent).toContain('Tội danh chính');
      // Giá trị đang chọn là nội dung của nút, nên nằm trong cây trợ năng.
      expect(trigger().textContent).toContain('Điều 173 · Tội trộm cắp tài sản');
    });

    it('ArrowDown trên nút mở hộp', () => {
      render(<CrimeSelect label="Tội danh" value="" onChange={() => {}} />);
      fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
      expect(screen.getByTestId('crime-select-dropdown')).toBeTruthy();
      expect(trigger().getAttribute('aria-expanded')).toBe('true');
    });

    it('ô trong <fieldset disabled> bị khoá thật: nút bị vô hiệu và bấm không mở được hộp', async () => {
      render(
        <fieldset disabled>
          <CrimeSelect label="Tội danh" value="" onChange={() => {}} />
        </fieldset>,
      );
      expect(trigger().matches(':disabled')).toBe(true);
      // `fireEvent.click` của jsdom cưỡng ép bắn sự kiện; trình duyệt thật và user-event thì không
      // gửi click tới nút đang bị khoá — đó mới là điều cần chứng minh.
      await userEvent.click(trigger());
      expect(screen.queryByTestId('crime-select-dropdown')).toBeNull();
    });

    it('prop disabled cũng khoá nút', () => {
      render(<CrimeSelect label="Tội danh" value="" onChange={() => {}} disabled />);
      expect(trigger().matches(':disabled')).toBe(true);
      fireEvent.click(trigger());
      expect(screen.queryByTestId('crime-select-dropdown')).toBeNull();
    });

    it('nút xoá nằm NGOÀI nút mở (không lồng button trong button) và xoá được mà không mở hộp', () => {
      const onChange = vi.fn();
      render(<CrimeSelect label="Tội danh" value="a" onChange={onChange} />);
      const clear = screen.getByTestId('crime-select-clear');
      expect(trigger().contains(clear)).toBe(false);
      fireEvent.click(clear);
      expect(onChange).toHaveBeenCalledWith('');
      expect(screen.queryByTestId('crime-select-dropdown')).toBeNull();
    });
  });

  describe('trong hộp', () => {
    it('ô tìm được lấy tiêu điểm khi hộp mở và trỏ tới listbox; nút mở trỏ cùng listbox đó', () => {
      render(<CrimeSelect label="Tội danh" value="" onChange={() => {}} />);
      moHop();
      expect(document.activeElement).toBe(search());
      const lb = screen.getByRole('listbox');
      expect(search().getAttribute('aria-controls')).toBe(lb.id);
      expect(trigger().getAttribute('aria-controls')).toBe(lb.id);
      expect(screen.getAllByRole('option')).toHaveLength(2); // chỉ tội PC02
    });

    it('↓ tô mục đầu, aria-activedescendant trỏ đúng mục; ↓ nữa sang mục kế', () => {
      render(<CrimeSelect label="Tội danh" value="" onChange={() => {}} />);
      moHop();
      fireEvent.keyDown(search(), { key: 'ArrowDown' });
      const opts = screen.getAllByRole('option');
      expect(search().getAttribute('aria-activedescendant')).toBe(opts[0].id);
      expect(opts[0].getAttribute('data-active')).toBe('true');
      fireEvent.keyDown(search(), { key: 'ArrowDown' });
      expect(search().getAttribute('aria-activedescendant')).toBe(opts[1].id);
    });

    it('Tab tới → ↓ mở → ↓↓ → Enter chọn ĐÚNG mục thứ hai và đóng hộp', () => {
      const onChange = vi.fn();
      render(<CrimeSelect label="Tội danh" value="" onChange={onChange} />);
      trigger().focus();
      fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
      fireEvent.keyDown(search(), { key: 'ArrowDown' });
      fireEvent.keyDown(search(), { key: 'ArrowDown' });
      fireEvent.keyDown(search(), { key: 'Enter' });
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith('b');
      expect(screen.queryByTestId('crime-select-dropdown')).toBeNull();
    });

    it('Enter khi CHƯA tô mục nào thì không chọn gì (không tự lấy mục đầu)', () => {
      const onChange = vi.fn();
      render(<CrimeSelect label="Tội danh" value="" onChange={onChange} />);
      moHop();
      fireEvent.change(search(), { target: { value: 'giết' } });
      fireEvent.keyDown(search(), { key: 'Enter' });
      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByTestId('crime-select-dropdown')).toBeTruthy();
    });

    it('Enter trong ô tìm bị chặn mặc định để không gửi form chứa ô này', () => {
      render(<CrimeSelect label="Tội danh" value="" onChange={() => {}} />);
      moHop();
      const khongBiChan = fireEvent.keyDown(search(), { key: 'Enter' });
      expect(khongBiChan).toBe(false); // false = preventDefault đã được gọi
    });

    it('gõ lọc xong thì bỏ tô: mục đang tô trước đó không bị Enter chọn nhầm', () => {
      const onChange = vi.fn();
      render(<CrimeSelect label="Tội danh" value="" onChange={onChange} />);
      moHop();
      fireEvent.keyDown(search(), { key: 'ArrowDown' });
      fireEvent.change(search(), { target: { value: 'trộm' } });
      fireEvent.keyDown(search(), { key: 'Enter' });
      expect(onChange).not.toHaveBeenCalled();
      // ↓ sau khi lọc: tô đúng mục còn lại.
      fireEvent.keyDown(search(), { key: 'ArrowDown' });
      fireEvent.keyDown(search(), { key: 'Enter' });
      expect(onChange).toHaveBeenCalledWith('b');
    });

    it('gõ tìm một tội ngoài PC02 rồi ↓ Enter chọn được nó', () => {
      const onChange = vi.fn();
      render(<CrimeSelect label="Tội danh" value="" onChange={onChange} />);
      moHop();
      fireEvent.change(search(), { target: { value: 'ma túy' } });
      fireEvent.keyDown(search(), { key: 'ArrowDown' });
      fireEvent.keyDown(search(), { key: 'Enter' });
      expect(onChange).toHaveBeenCalledWith('c');
    });

    it('đang gõ dấu tiếng Việt (isComposing) thì ↓ và Enter không làm gì', () => {
      const onChange = vi.fn();
      render(<CrimeSelect label="Tội danh" value="" onChange={onChange} />);
      moHop();
      fireEvent.keyDown(search(), { key: 'ArrowDown', isComposing: true });
      fireEvent.keyDown(search(), { key: 'Enter', isComposing: true });
      expect(onChange).not.toHaveBeenCalled();
      expect(search().getAttribute('aria-activedescendant')).toBeNull();
    });

    it('Escape đóng hộp và trả tiêu điểm về nút mở', () => {
      render(<CrimeSelect label="Tội danh" value="" onChange={() => {}} />);
      moHop();
      fireEvent.keyDown(search(), { key: 'Escape' });
      expect(screen.queryByTestId('crime-select-dropdown')).toBeNull();
      expect(document.activeElement).toBe(trigger());
    });

    it('Tab đóng hộp mà KHÔNG chặn mặc định (tiêu điểm đi tiếp)', () => {
      render(<CrimeSelect label="Tội danh" value="" onChange={() => {}} />);
      moHop();
      const khongBiChan = fireEvent.keyDown(search(), { key: 'Tab' });
      expect(khongBiChan).toBe(true);
      expect(screen.queryByTestId('crime-select-dropdown')).toBeNull();
    });

    it('mục đã chọn mang aria-selected, mục đang tô thì không bị gộp với "đã chọn"', () => {
      render(<CrimeSelect label="Tội danh" value="a" onChange={() => {}} />);
      moHop();
      const opts = screen.getAllByRole('option');
      expect(opts[0].getAttribute('aria-selected')).toBe('true');
      expect(opts[1].getAttribute('aria-selected')).toBe('false');
      fireEvent.keyDown(search(), { key: 'ArrowDown' });
      fireEvent.keyDown(search(), { key: 'ArrowDown' });
      // Đang tô mục thứ hai nhưng "đã chọn" vẫn là mục đầu.
      expect(opts[1].getAttribute('aria-selected')).toBe('false');
      expect(opts[0].getAttribute('aria-selected')).toBe('true');
    });

    it('bấm chuột vào mục vẫn chọn được như trước', () => {
      const onChange = vi.fn();
      render(<CrimeSelect label="Tội danh" value="" onChange={onChange} />);
      moHop();
      fireEvent.click(screen.getByTestId('crime-select-option-D173'));
      expect(onChange).toHaveBeenCalledWith('b');
    });
  });
});
