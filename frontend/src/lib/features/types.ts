export interface FeatureFlag {
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  domain: string | null;
  rolloutPct: number;
}
