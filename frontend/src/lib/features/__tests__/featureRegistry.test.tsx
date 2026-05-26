import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { FEATURE_MODULES, getFeatureModule } from '../featureRegistry';

type RouteElement = ReactElement<{ path?: string }>;

describe('FEATURE_MODULES registry', () => {
  it('auto-discovers all 23 expected features', () => {
    const expected = [
      'admin',
      'admin-units', // v0.34.0.0 — read-only browser cho Tỉnh/Phường
      'calendar',
      'cases',
      'classification',
      'comprehensive', // v0.37.1 — cross-entity views (Tổng hợp menu)
      'dashboard',
      'directory',
      'document-numbers', // v0.42.0.0 — Quản lý Mã số chứng từ
      'documents',
      'edit-window-requests', // v0.36.0.0 — admin queue Phase 5-lite reset requests
      'incidents',
      'journey', // v0.40.0.0 — Hành trình hồ sơ standalone page
      'kpi',
      'lawyers',
      'master-class',
      'petitions',
      'reports',
      'settings',
      'subjects',
      'teams',
      'uy-thac-dieu-tra', // v0.44 — Ủy Thác Điều Tra
      'workflow',
    ];
    const actual = FEATURE_MODULES.map((f) => f.manifest.key).sort();
    expect(actual).toEqual(expected);
  });

  it('has unique keys across all features', () => {
    const keys = FEATURE_MODULES.map((f) => f.manifest.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has no duplicate route paths across features', () => {
    const allPaths: string[] = [];
    for (const feature of FEATURE_MODULES) {
      const routes = feature.renderRoutes();
      for (const el of routes as RouteElement[]) {
        if (el.props?.path) allPaths.push(el.props.path);
      }
    }
    expect(new Set(allPaths).size).toBe(allPaths.length);
  });

  it('every discovered module has a valid manifest', () => {
    for (const feature of FEATURE_MODULES) {
      expect(feature.manifest.key).toBeTruthy();
      expect(feature.manifest.label).toBeTruthy();
      expect(feature.manifest.domain).toBeTruthy();
      expect(typeof feature.renderRoutes).toBe('function');
    }
  });

  it('renderRoutes returns an array of React elements', () => {
    const cases = getFeatureModule('cases');
    expect(cases).toBeDefined();
    const routes = cases!.renderRoutes();
    expect(Array.isArray(routes)).toBe(true);
    expect(routes.length).toBeGreaterThan(0);
    // Every element should be a <Route> (has props.path)
    for (const el of routes) {
      expect(el).toBeDefined();
      // React element shape: { type, props, key }
      expect(el.key).toBeDefined();
    }
  });

  it('cases feature exposes the expected routes', () => {
    const cases = getFeatureModule('cases');
    const routes = cases!.renderRoutes();
    const paths = (routes as RouteElement[])
      .map((el) => el.props?.path)
      .filter(Boolean)
      .sort();
    expect(paths).toEqual([
      // v0.37.1: /add-new-record kept as legacy redirect to /cases/new
      // /comprehensive-list and /initial-cases moved to features/comprehensive (PR-MENU-TONGHOP)
      '/add-new-record',
      '/cases',
      '/cases/:id',
      '/cases/:id/edit',
      '/cases/:id/journey',
      '/cases/new',
      '/cases/tdac-backfill',
    ]);
  });

  it('cases feature exposes menu entries for the business section', () => {
    const cases = getFeatureModule('cases');
    expect(cases!.menu).toBeDefined();
    const topItems = cases!.menu!;
    expect(topItems.length).toBeGreaterThan(0);
    expect(topItems[0].section).toBe('business');
    expect(topItems[0].children?.length).toBeGreaterThan(0);
  });

  it('getFeatureModule returns undefined for unknown keys', () => {
    expect(getFeatureModule('does-not-exist')).toBeUndefined();
  });
});
