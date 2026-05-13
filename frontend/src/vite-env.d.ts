/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  // Mobile app download URLs surfaced on LoginPage "Tải ứng dụng di động"
  // section. Build-time inject via .env.local / .env.production. When unset
  // (or empty string), the section shows "Sắp ra mắt" placeholder instead.
  readonly VITE_MOBILE_ANDROID_URL?: string;
  readonly VITE_MOBILE_IOS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.png' {
  const src: string;
  export default src;
}
