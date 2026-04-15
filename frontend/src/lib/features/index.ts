export { FeatureFlagsProvider, useFeatureFlagsContext } from './FeatureFlagsContext';
export { useFeature, useEnabledFeatures } from './useFeature';
export { useMenuSections } from './useMenuSections';
export { FEATURE_MODULES, getFeatureModule } from './featureRegistry';
export { iconFor } from './iconRegistry';
export type { FeatureFlag } from './types';
export type {
  FeatureModule,
  FeatureModuleManifest,
  FeatureMenuEntry,
} from './moduleTypes';
export type {
  ResolvedMenuItem,
  ResolvedMenuSection,
  SectionId,
} from './useMenuSections';
