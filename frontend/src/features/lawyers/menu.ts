import type { FeatureMenuEntry } from '@/lib/features/moduleTypes';

// v0.37.1: Luật sư moved to child of Đối tượng liên quan (features/subjects/menu.ts).
// Route /lawyers stays — only menu position changed. Bookmarks won't break.
// Empty array tells the feature registry not to add a top-level menu entry.
export const lawyersMenu: FeatureMenuEntry[] = [];
