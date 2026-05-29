import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyMobileState } from '../EmptyMobileState';

describe('EmptyMobileState', () => {
  it('renders the title', () => {
    render(<EmptyMobileState title="Không có vụ án nào" />);
    expect(screen.getByText('Không có vụ án nào')).toBeTruthy();
  });

  it('renders empty variant by default', () => {
    render(<EmptyMobileState title="Trống" />);
    expect(screen.getByTestId('empty-mobile-empty')).toBeTruthy();
  });

  it('renders error variant when specified', () => {
    render(<EmptyMobileState title="Lỗi" variant="error" />);
    expect(screen.getByTestId('empty-mobile-error')).toBeTruthy();
  });

  it('does not render retry button when onRetry is not provided', () => {
    render(<EmptyMobileState title="Trống" />);
    expect(screen.queryByText('Tải lại')).toBeNull();
  });

  it('renders retry button with default label when onRetry is provided', () => {
    const onRetry = vi.fn();
    render(<EmptyMobileState title="Lỗi" onRetry={onRetry} />);
    expect(screen.getByText('Tải lại')).toBeTruthy();
  });

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    render(<EmptyMobileState title="Lỗi" onRetry={onRetry} />);
    fireEvent.click(screen.getByText('Tải lại'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders custom retry label', () => {
    const onRetry = vi.fn();
    render(<EmptyMobileState title="Lỗi" onRetry={onRetry} retryLabel="Thử lại" />);
    expect(screen.getByText('Thử lại')).toBeTruthy();
  });

  it('retry button has 44px minimum touch target', () => {
    const onRetry = vi.fn();
    render(<EmptyMobileState title="Lỗi" onRetry={onRetry} />);
    const btn = screen.getByText('Tải lại').closest('button');
    expect(btn?.className).toMatch(/min-h-\[44px\]/);
  });

  it('renders description when provided', () => {
    render(<EmptyMobileState title="Trống" description="Chưa có vụ án nào được tạo" />);
    expect(screen.getByText('Chưa có vụ án nào được tạo')).toBeTruthy();
  });
});
