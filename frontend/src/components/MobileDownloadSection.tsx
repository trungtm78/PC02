import { Component, type ReactNode } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { SiAndroid, SiApple } from 'react-icons/si';

import { getMobileDownloadConfig } from '@/lib/mobile-download';
import { mobileDownload as t } from '@/locales/vi';

/**
 * "Tải ứng dụng di động" — surfaces Android QR + download link on LoginPage.
 *
 * Visual direction approved during /plan-design-review: SUBTLE — matches the
 * adjacent "Lưu ý" info box exact tokens (slate-50 bg, slate-200 border) so
 * the section reads as auxiliary utility info, not as a competing CTA.
 *
 * Hidden on viewports < sm because the user is already on the device the QR
 * would point them to; scanning your own screen with the same phone is not a
 * real use case. Desktop users get the QR, mobile users get no noise.
 *
 * iOS column is always disabled (the iOS app is not yet shipped). The greyed
 * striped placeholder communicates this visually; screen readers receive
 * explicit context via aria-label. We intentionally do NOT show a "Đang phát
 * triển" caption (per design review — cleaner, less defeatist).
 */
export default function MobileDownloadSection() {
  const config = getMobileDownloadConfig();
  return (
    <section
      aria-labelledby="mobile-dl-heading"
      className="hidden sm:block mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg"
    >
      <h2
        id="mobile-dl-heading"
        className="text-sm font-medium text-slate-700 mb-3"
      >
        {t.sectionTitle}
      </h2>
      <div className="grid grid-cols-2 gap-4">
        <AndroidColumn url={config.androidUrl} />
        <IosColumn
          available={config.iosAvailable}
          url={config.iosUrl}
        />
      </div>
    </section>
  );
}

function AndroidColumn({ url }: { url: string | null }) {
  return (
    <div className="flex flex-col items-center">
      {url ? (
        <QRBoundary url={url}>
          <QRCodeSVG
            value={url}
            size={96}
            level="M"
            aria-label={t.qrAriaLabel(t.androidLabel)}
            role="img"
          />
        </QRBoundary>
      ) : (
        <ComingSoonPlaceholder />
      )}
      <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-700">
        <SiAndroid className="w-3.5 h-3.5 text-[#3DDC84]" aria-hidden="true" />
        {t.androidLabel}
      </div>
      {url && (
        <a
          href={url}
          download
          className="text-xs text-[#003973] hover:text-[#002255] hover:underline focus:outline-none focus:ring-2 focus:ring-[#003973]/40 rounded-sm inline-block py-2 px-1 mt-1"
        >
          {t.androidDownloadLink}
        </a>
      )}
    </div>
  );
}

function IosColumn({
  available,
  url,
}: {
  available: boolean;
  url: string | null;
}) {
  // When iOS ships (Apple Dev account + TestFlight/App Store), set
  // `iosAvailable: true` in mobile-download.ts. The column flips to render a
  // real QR + link, same shape as Android. Until then, the striped greyed
  // placeholder communicates "not yet" — no "Đang phát triển" caption per
  // /plan-design-review (cleaner, less defeatist).
  if (available && url) {
    return (
      <div className="flex flex-col items-center">
        <QRBoundary url={url}>
          <QRCodeSVG
            value={url}
            size={96}
            level="M"
            aria-label={t.qrAriaLabel(t.iosLabel)}
            role="img"
          />
        </QRBoundary>
        <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-700">
          <SiApple className="w-3.5 h-3.5 text-slate-800" aria-hidden="true" />
          {t.iosLabel}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center">
      <div
        role="img"
        aria-label={t.placeholderAriaLabel(t.iosLabel)}
        className="w-24 h-24 rounded flex items-center justify-center"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, rgb(226 232 240) 0 8px, rgb(241 245 249) 8px 16px)',
          opacity: 0.4,
        }}
      >
        <SiApple className="w-10 h-10 text-slate-800" aria-hidden="true" />
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-700">
        <SiApple className="w-3.5 h-3.5 text-slate-800" aria-hidden="true" />
        {t.iosLabel}
      </div>
    </div>
  );
}

function ComingSoonPlaceholder() {
  // Env-unset state. Anh dropped the "Sắp ra mắt" caption — the dashed border
  // + brand-colored Android logo are enough to signal "Android app exists but
  // QR not configured yet". Screen reader still gets explicit context via
  // aria-label so sighted vs assistive-tech parity holds.
  return (
    <div
      role="img"
      aria-label={t.placeholderAriaLabel('Android')}
      className="w-24 h-24 bg-slate-100 border border-dashed border-slate-300 rounded flex items-center justify-center"
    >
      <SiAndroid className="w-10 h-10 text-[#3DDC84]" aria-hidden="true" />
    </div>
  );
}

/**
 * Local error boundary just for the QR code so a malformed URL (extremely
 * long, invalid characters that exceed QR capacity) can't crash the whole
 * login page. Falls back to a plain-text "Truy cập trực tiếp: <url>" link.
 */
class QRBoundary extends Component<
  { url: string; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <a
          href={this.props.url}
          download
          className="block w-24 text-xs text-[#003973] hover:underline break-all"
        >
          {t.qrErrorFallback(this.props.url)}
        </a>
      );
    }
    return <>{this.props.children}</>;
  }
}
