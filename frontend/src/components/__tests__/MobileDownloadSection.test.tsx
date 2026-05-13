import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import MobileDownloadSection from '../MobileDownloadSection';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('MobileDownloadSection', () => {
  it('renders the Vietnamese section heading', () => {
    render(<MobileDownloadSection />);
    expect(screen.getByText('Tải ứng dụng di động')).toBeInTheDocument();
  });

  it('renders a QR (role="img") for Android when VITE_MOBILE_ANDROID_URL is set', () => {
    vi.stubEnv(
      'VITE_MOBILE_ANDROID_URL',
      'http://171.244.40.245/downloads/latest.apk',
    );
    render(<MobileDownloadSection />);
    expect(
      screen.getByRole('img', { name: 'Mã QR tải ứng dụng Android' }),
    ).toBeInTheDocument();
  });

  it('renders placeholder (no QR) when env is unset', () => {
    vi.stubEnv('VITE_MOBILE_ANDROID_URL', '');
    render(<MobileDownloadSection />);
    // No QR — placeholder visual takes its slot. The placeholder is reachable
    // by aria-label so screen readers know the Android app exists but isn't
    // yet configured for download.
    expect(
      screen.queryByRole('img', { name: 'Mã QR tải ứng dụng Android' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Ứng dụng Android chưa sẵn sàng' }),
    ).toBeInTheDocument();
  });

  it('does NOT render "Sắp ra mắt" caption (anh dropped for cleaner UI)', () => {
    vi.stubEnv('VITE_MOBILE_ANDROID_URL', '');
    render(<MobileDownloadSection />);
    expect(screen.queryByText('Sắp ra mắt')).not.toBeInTheDocument();
  });

  it('renders the "Tải APK trực tiếp" link pointing at env URL when set', () => {
    vi.stubEnv(
      'VITE_MOBILE_ANDROID_URL',
      'http://171.244.40.245/downloads/latest.apk',
    );
    render(<MobileDownloadSection />);
    const link = screen.getByRole('link', { name: 'Tải APK trực tiếp' });
    expect(link).toHaveAttribute(
      'href',
      'http://171.244.40.245/downloads/latest.apk',
    );
    expect(link).toHaveAttribute('download');
  });

  it('does NOT render the Android download link when env is unset', () => {
    vi.stubEnv('VITE_MOBILE_ANDROID_URL', '');
    render(<MobileDownloadSection />);
    expect(
      screen.queryByRole('link', { name: 'Tải APK trực tiếp' }),
    ).not.toBeInTheDocument();
  });

  it('always renders the iOS column with placeholder aria-label (regardless of env)', () => {
    vi.stubEnv('VITE_MOBILE_IOS_URL', 'https://testflight.apple.com/join/abc');
    render(<MobileDownloadSection />);
    // iOS always disabled until iosAvailable flag flips — even if env URL set,
    // we render the placeholder (per plan-design-review decision).
    expect(
      screen.getByRole('img', { name: 'Ứng dụng iOS chưa sẵn sàng' }),
    ).toBeInTheDocument();
    // And label "iOS" appears
    expect(screen.getByText('iOS')).toBeInTheDocument();
  });

  it('does NOT render "Đang phát triển" caption (anh removed for cleaner UI)', () => {
    render(<MobileDownloadSection />);
    expect(screen.queryByText('Đang phát triển')).not.toBeInTheDocument();
  });

  it('hides on mobile via the `hidden sm:block` utility classes', () => {
    const { container } = render(<MobileDownloadSection />);
    const section = container.querySelector('section');
    expect(section).not.toBeNull();
    expect(section?.className).toContain('hidden');
    expect(section?.className).toContain('sm:block');
  });
});
