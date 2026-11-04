import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReadingProgress } from '../ReadingProgress';

const NOW = new Date('2026-11-04T08:00:00Z').getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

const stepState = (name: RegExp) => screen.getByText(name).closest('li')!.getAttribute('data-state');

describe('ReadingProgress', () => {
  it('names what the system is doing, with the page count', () => {
    render(<ReadingProgress kind="READ" stage="READING_PAGES" pageCount={3} startedAt={NOW} finalStep="fill" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Đọc chữ trên 3 trang ảnh')).toBeInTheDocument();
    expect(screen.getByText(/Phân tích nội dung/)).toBeInTheDocument();
    expect(screen.getByText('Điền vào form')).toBeInTheDocument();
  });

  it('marks the page-reading step as current while pages are read', () => {
    render(<ReadingProgress kind="READ" stage="READING_PAGES" pageCount={2} startedAt={NOW} finalStep="fill" />);
    expect(stepState(/Đọc chữ/)).toBe('now');
    expect(stepState(/Phân tích nội dung/)).toBe('pending');
    expect(stepState(/Điền vào form/)).toBe('pending');
  });

  it('treats a job the server has not started yet as still reading', () => {
    render(<ReadingProgress kind="READ" stage={null} pageCount={2} startedAt={NOW} finalStep="fill" />);
    expect(stepState(/Đọc chữ/)).toBe('now');
  });

  it('moves on to the analysis step once the pages are read', () => {
    render(<ReadingProgress kind="READ" stage="ANALYSING" pageCount={2} startedAt={NOW} finalStep="fill" />);
    expect(stepState(/Đọc chữ/)).toBe('done');
    expect(stepState(/Phân tích nội dung/)).toBe('now');
    expect(stepState(/Điền vào form/)).toBe('pending');
  });

  it('an analysis-only job has no page-reading step', () => {
    render(<ReadingProgress kind="ANALYSE" stage="ANALYSING" pageCount={2} startedAt={NOW} finalStep="fill" />);
    expect(screen.queryByText(/Đọc chữ/)).toBeNull();
    expect(stepState(/Phân tích nội dung/)).toBe('now');
  });

  it('the screen that compares with a saved record names its last step that way', () => {
    render(<ReadingProgress kind="READ" stage="ANALYSING" pageCount={1} startedAt={NOW} finalStep="compare" />);
    expect(screen.getByText('So sánh với hồ sơ hiện tại')).toBeInTheDocument();
    expect(screen.queryByText('Điền vào form')).toBeNull();
  });

  it('counts the seconds waited, ticking every second', () => {
    render(<ReadingProgress kind="READ" stage="READING_PAGES" pageCount={1} startedAt={NOW} finalStep="fill" />);
    expect(screen.getByText('Đã chờ 0:00')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(65_000);
    });
    expect(screen.getByText('Đã chờ 1:05')).toBeInTheDocument();
  });

  it('counts from when the reading started, not from when the panel opened', () => {
    render(<ReadingProgress kind="READ" stage="READING_PAGES" pageCount={1} startedAt={NOW - 42_000} finalStep="fill" />);
    expect(screen.getByText('Đã chờ 0:42')).toBeInTheDocument();
  });

  it('reassures the officer only after a long wait', () => {
    render(<ReadingProgress kind="READ" stage="ANALYSING" pageCount={3} startedAt={NOW} finalStep="fill" />);
    expect(screen.queryByText(/mất tới 2 phút/)).toBeNull();
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(screen.getByText(/mất tới 2 phút/)).toBeInTheDocument();
  });

  it('stops its timer when it goes away', () => {
    const { unmount } = render(
      <ReadingProgress kind="READ" stage="READING_PAGES" pageCount={1} startedAt={NOW} finalStep="fill" />,
    );
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
