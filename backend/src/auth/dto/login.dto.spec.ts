import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LoginDto } from './login.dto';

// v0.27 multi-field login: LoginDto.username accept email/workId/phone/username shape.
// KHÔNG dùng @IsEmail() — backend service classify shape via classifyIdentifier().

describe('LoginDto', () => {
  const valid = async (data: Record<string, unknown>) => {
    const dto = plainToInstance(LoginDto, data);
    const errors = await validate(dto);
    return errors;
  };

  describe('username field — accept all 4 identifier shapes', () => {
    it('accepts email format', async () => {
      expect(await valid({ username: 'admin@pc02.local', password: 'Admin@1234!' })).toEqual([]);
    });

    it('accepts workId format (XXX-XXX)', async () => {
      expect(await valid({ username: '277-794', password: 'Admin@1234!' })).toEqual([]);
    });

    it('accepts legacy workId format (PC02-DTV-001)', async () => {
      expect(await valid({ username: 'PC02-DTV-001', password: 'Admin@1234!' })).toEqual([]);
    });

    it('accepts phone format', async () => {
      expect(await valid({ username: '0934314279', password: 'Admin@1234!' })).toEqual([]);
    });

    it('accepts username format', async () => {
      expect(await valid({ username: 'admin', password: 'Admin@1234!' })).toEqual([]);
    });
  });

  describe('username field — bounds', () => {
    it('rejects empty string', async () => {
      const errors = await valid({ username: '', password: 'Admin@1234!' });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('username');
    });

    it('rejects string shorter than 3 chars', async () => {
      const errors = await valid({ username: 'ab', password: 'Admin@1234!' });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects string longer than 254 chars (RFC 5322 email cap)', async () => {
      const tooLong = 'a'.repeat(255);
      const errors = await valid({ username: tooLong, password: 'Admin@1234!' });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('accepts string at boundary 254 chars', async () => {
      const at254 = 'a'.repeat(254);
      const errors = await valid({ username: at254, password: 'Admin@1234!' });
      expect(errors).toEqual([]);
    });

    it('accepts string at boundary 3 chars', async () => {
      expect(await valid({ username: 'abc', password: 'Admin@1234!' })).toEqual([]);
    });
  });

  describe('password field — unchanged', () => {
    it('rejects password shorter than 6 chars', async () => {
      const errors = await valid({ username: 'admin', password: '12345' });
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });

    it('rejects missing password', async () => {
      const errors = await valid({ username: 'admin' });
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });
  });
});
