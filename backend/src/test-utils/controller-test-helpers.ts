import type { Type } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { ScopedRequest } from '../auth/interfaces/scoped-request.interface';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

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
  extraProviders: { token: Type; mock: Record<string, jest.Mock> }[] = [],
): Promise<TestingModule> {
  return Test.createTestingModule({
    controllers: [controller],
    providers: [
      { provide: service, useValue: mockService },
      ...extraProviders.map((p) => ({ provide: p.token, useValue: p.mock })),
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .overrideGuard(PermissionsGuard)
    .useValue({ canActivate: () => true })
    .compile();
}

/**
 * Minimal ScopedRequest mock for controller tests.
 *
 * Returns `ScopedRequest`, not `any`. As `any` it silently infected every
 * assertion that touched it — `expect(...).toHaveBeenCalledWith(req.dataScope)`
 * became an unchecked comparison, and each caller collected a handful of
 * no-unsafe-* errors it could do nothing about.
 */
export function makeReq(
  overrides: Record<string, unknown> = {},
): ScopedRequest {
  return {
    ip: '127.0.0.1',
    headers: { 'user-agent': 'jest-test' },
    user: { id: 'user-001', email: 'test@pc02.local', role: 'OFFICER' },
    dataScope: { teamIds: [], userIds: [], isAdmin: false },
    ...overrides,
  } as unknown as ScopedRequest;
}

/** Minimal AuthUser mock. */
export const mockUser: AuthUser = {
  id: 'user-001',
  email: 'test@pc02.local',
  role: 'OFFICER',
  roleId: 'role-001',
} as unknown as AuthUser;
