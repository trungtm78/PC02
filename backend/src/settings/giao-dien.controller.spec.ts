import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { GiaoDienController } from './giao-dien.controller';
import { SettingsController } from './settings.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';

describe('GiaoDienController', () => {
  it('ủy quyền cho service.getGiaoDien', async () => {
    const service = { getGiaoDien: jest.fn().mockResolvedValue({ success: true, data: {} }) };
    const c = new GiaoDienController(service as never);
    await c.getGiaoDien();
    expect(service.getGiaoDien).toHaveBeenCalledTimes(1);
  });

  it('chỉ cần ĐĂNG NHẬP: có JwtAuthGuard, KHÔNG PermissionsGuard, không đòi quyền Setting', () => {
    const guards = (Reflect.getMetadata(GUARDS_METADATA, GiaoDienController) ?? []) as unknown[];
    expect(guards).toContain(JwtAuthGuard);
    expect(guards).not.toContain(PermissionsGuard);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, GiaoDienController.prototype.getGiaoDien)).toBeUndefined();
  });

  it('đối chứng: ghi cấu hình (PUT /settings/:key) vẫn đòi write:Setting', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, SettingsController.prototype.updateValue)).toEqual([
      { action: 'write', subject: 'Setting' },
    ]);
  });
});
