import { useState } from 'react';
import { useFeatureBatMacDinh } from '@/lib/features/useFeature';

/**
 * Which way the figures of a dynamic report are shown: the template as a grid (the form the officers already
 * know), or the plain list.
 *
 *  - The grid is the DEFAULT, with an emergency switch: the flag `dynamic_reports_grid` is ON unless an admin
 *    turns it off (an unseeded flag is on), and turning it off brings the list back for everyone without a deploy.
 *  - The list stays the starting point on a narrow screen (a phone), and wherever the screen cannot be measured.
 *  - What a person picked is remembered on that device (a convenience only: unreadable storage changes nothing).
 */

export const GRID_FLAG = 'dynamic_reports_grid';
export const GRID_LAYOUT_STORAGE_KEY = 'dr.layout';
const NARROW_SCREEN = '(max-width: 767px)';

export type LayoutMode = 'list' | 'grid';

function canMeasureScreen(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

function initialChoice(): LayoutMode {
  if (!canMeasureScreen()) return 'list';
  try {
    const stored = window.localStorage.getItem(GRID_LAYOUT_STORAGE_KEY);
    if (stored === 'list' || stored === 'grid') return stored;
  } catch {
    // storage blocked: fall through to the default
  }
  return window.matchMedia(NARROW_SCREEN).matches ? 'list' : 'grid';
}

function remember(mode: LayoutMode): void {
  if (!canMeasureScreen()) return; // no real browser (a test run): nothing to remember it for
  try {
    window.localStorage.setItem(GRID_LAYOUT_STORAGE_KEY, mode);
  } catch {
    // storage blocked: the choice simply is not remembered
  }
}

export function useGridLayout(): {
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
  /** False when the emergency switch is off: the grid cannot be opened and no switch is offered. */
  gridAllowed: boolean;
} {
  const gridAllowed = useFeatureBatMacDinh(GRID_FLAG);
  const [choice, setChoice] = useState<LayoutMode>(initialChoice);
  return {
    layoutMode: gridAllowed ? choice : 'list',
    setLayoutMode: (mode) => {
      setChoice(mode);
      remember(mode);
    },
    gridAllowed,
  };
}
