import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateUserDto } from './create-user.dto';

// v0.28: username chỉ được phép chứa chữ thường, số, dấu _ — nhưng KHÔNG được thuần số
// (chống collision với Mã cán bộ shape pure-digit).

describe('CreateUserDto username validation', () => {
  const baseValid = {
    workId: '277-001',
    roleId: 'role-1',
  };

  const valid = async (username: string) => {
    const dto = plainToInstance(CreateUserDto, { ...baseValid, username });
    return validate(dto);
  };

  describe('v0.28 — ban username thuần số', () => {
    it('rejects pure digit username (vd "12345")', async () => {
      const errors = await valid('12345');
      const usernameErr = errors.find((e) => e.property === 'username');
      expect(usernameErr).toBeDefined();
    });

    it('rejects pure digit username 3 chars (boundary)', async () => {
      const errors = await valid('001');
      const usernameErr = errors.find((e) => e.property === 'username');
      expect(usernameErr).toBeDefined();
    });

    it('rejects pure digit username 20 chars (max length boundary)', async () => {
      const errors = await valid('12345678901234567890');
      const usernameErr = errors.find((e) => e.property === 'username');
      expect(usernameErr).toBeDefined();
    });
  });

  describe('accepts username với ít nhất 1 ký tự chữ', () => {
    it('accepts alphanumeric mix (vd "abc123")', async () => {
      const errors = await valid('abc123');
      const usernameErr = errors.find((e) => e.property === 'username');
      expect(usernameErr).toBeUndefined();
    });

    it('accepts digit-then-letter (vd "001abc")', async () => {
      const errors = await valid('001abc');
      const usernameErr = errors.find((e) => e.property === 'username');
      expect(usernameErr).toBeUndefined();
    });

    it('accepts letter-with-underscore (vd "user_001")', async () => {
      const errors = await valid('user_001');
      const usernameErr = errors.find((e) => e.property === 'username');
      expect(usernameErr).toBeUndefined();
    });

    it('accepts pure letter (vd "admin")', async () => {
      const errors = await valid('admin');
      const usernameErr = errors.find((e) => e.property === 'username');
      expect(usernameErr).toBeUndefined();
    });
  });
});
