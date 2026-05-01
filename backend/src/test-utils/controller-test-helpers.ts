import type { Type } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';

/**
 * Build a NestJS testing module for a controller with mocked service and guards disabled.
 * Usage:
 *   const module = await buildControllerModule(MyController, MyService, mockService);
 *   controller = module.get(MyController);
 */
export async function buildControllerModule(
  controller: Type,
  service: Type,
  mockService: Record<string, jest.Mock>,
): Promise<TestingModule> {
  return Test.createTestingModule({
    controllers: [controller],
    providers: [{ provide: service, useValue: mockService }],
  })
    .overrideGuard(require('../auth/guards/jwt-auth.guard').JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .overrideGuard(require('../auth/guards/permissions.guard').PermissionsGuard)
    .useValue({ canActivate: () => true })
    .compile();
}

/** Minimal ScopedRequest mock for controller tests. */
export function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    ip: '127.0.0.1',
    headers: { 'user-agent': 'jest-test' },
    user: { id: 'user-001', email: 'test@pc02.local', role: 'OFFICER' },
    dataScope: { teamIds: [], userIds: [], isAdmin: false },
    ...overrides,
  } as any;
}

/** Minimal AuthUser mock. */
export const mockUser = {
  id: 'user-001',
  email: 'test@pc02.local',
  role: 'OFFICER',
  roleId: 'role-001',
} as any;
