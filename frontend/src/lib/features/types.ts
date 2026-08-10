export interface FeatureFlag {
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  domain: string | null;
  rolloutPct: number;
  /** Flags that cannot be switched off; the API refuses and the UI disables the toggle. */
  isCore?: boolean;
}
