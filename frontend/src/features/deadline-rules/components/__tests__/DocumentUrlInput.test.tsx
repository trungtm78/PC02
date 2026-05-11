import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DocumentUrlInput } from '../DocumentUrlInput';

describe('DocumentUrlInput', () => {
  it('renders no error/hint when value is empty and untouched', () => {
    render(<DocumentUrlInput value="" onChange={() => {}} />);
    expect(screen.queryByTestId('document-url-error')).toBeNull();
    expect(screen.queryByTestId('document-url-hint')).toBeNull();
    // helper text visible
    expect(screen.getByText(/Gợi ý nguồn chính thức/)).toBeInTheDocument();
  });

  it('shows green hint with official-source label after blur on vbpl.vn URL', () => {
    render(<DocumentUrlInput value="https://vbpl.vn/bo-luat-to-tung-hinh-su-2015" onChange={() => {}} />);
    fireEvent.blur(screen.getByTestId('document-url-input'));
    const hint = screen.getByTestId('document-url-hint');
    expect(hint).toHaveTextContent('Cơ sở dữ liệu pháp luật quốc gia');
    expect(screen.queryByTestId('document-url-non-official')).toBeNull();
  });

  it('shows red error after blur for javascript: URL', () => {
    render(<DocumentUrlInput value="javascript:alert(1)" onChange={() => {}} />);
    fireEvent.blur(screen.getByTestId('document-url-input'));
    expect(screen.getByTestId('document-url-error')).toBeInTheDocument();
    expect(screen.getByTestId('document-url-input')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows red error after blur for http://localhost URL', () => {
    render(<DocumentUrlInput value="http://localhost:3000/page" onChange={() => {}} />);
    fireEvent.blur(screen.getByTestId('document-url-input'));
    expect(screen.getByTestId('document-url-error')).toBeInTheDocument();
  });

  it('shows green hint plus amber non-official chip for thuvienphapluat.vn', () => {
    render(<DocumentUrlInput value="https://thuvienphapluat.vn/van-ban/abc" onChange={() => {}} />);
    fireEvent.blur(screen.getByTestId('document-url-input'));
    const hint = screen.getByTestId('document-url-hint');
    expect(hint).toHaveTextContent('Thư viện Pháp luật');
    expect(screen.getByTestId('document-url-non-official')).toHaveTextContent('không phải nguồn chính thức');
  });

  it('calls onChange when user types', () => {
    const onChange = vi.fn();
    render(<DocumentUrlInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByTestId('document-url-input'), { target: { value: 'https://example.com' } });
    expect(onChange).toHaveBeenCalledWith('https://example.com');
  });

  it('does not show error before user blurs even with invalid value', () => {
    render(<DocumentUrlInput value="not-a-url" onChange={() => {}} />);
    expect(screen.queryByTestId('document-url-error')).toBeNull();
  });
});
