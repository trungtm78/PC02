import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { IsEmail, Matches } from 'class-validator';
import { TestModeGuard } from './guards/test-mode.guard';
import {
  SeedTestUserDto,
  E2E_EMAIL_PATTERN,
} from './dto/seed-test-user.dto';
import {
  TestFixturesService,
  type SeededTestUser,
} from './test-fixtures.service';

class CurrentOtpQueryDto {
  @IsEmail()
  @Matches(E2E_EMAIL_PATTERN)
  email!: string;
}

/**
 * Maestro E2E test fixtures. NOT mounted in production — the parent
 * module conditionally imports TestFixturesModule only when
 * `process.env.E2E_TEST_MODE === 'true'`.
 *
 * Auth model:
 *   - TestModeGuard: env + token + constant-time check (see guard).
 *   - Throttler skipped because Maestro flows fire many seeds in sequence
 *     and the global 200/min would interfere. The guard is the real defense.
 *   - JwtAuthGuard intentionally NOT applied — caller (Maestro) has no JWT.
 */
@UseGuards(TestModeGuard)
@SkipThrottle()
@Controller('test')
export class TestFixturesController {
  constructor(private readonly fixtures: TestFixturesService) {}

  @Post('seed-user')
  @HttpCode(200)
  async seedUser(@Body() dto: SeedTestUserDto): Promise<SeededTestUser> {
    return this.fixtures.seedUser(dto);
  }

  @Get('current-otp')
  async currentOtp(@Query() q: CurrentOtpQueryDto) {
    return this.fixtures.currentTotpCode(q.email);
  }

  @Delete('e2e-users')
  async deleteE2eUsers() {
    return this.fixtures.deleteAllE2eUsers();
  }
}
