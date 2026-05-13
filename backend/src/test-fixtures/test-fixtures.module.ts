import { DynamicModule, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TotpEncryptionService } from '../auth/services/totp-encryption.service';
import { TestFixturesController } from './test-fixtures.controller';
import { TestFixturesService } from './test-fixtures.service';

/**
 * `forRoot()` returns either the live module or an empty stub. The host
 * AppModule calls `TestFixturesModule.forRoot()` unconditionally and lets
 * THIS class decide based on env. Two reasons we do it here, not in
 * AppModule:
 *
 *  1. The conditional decision lives next to the fixture code, so deleting
 *     this folder removes the entire surface (zero stragglers in app.module).
 *
 *  2. The module never appears in production module graphs — easier to
 *     audit "is this enabled in prod?" by `git grep TestFixtures` finding
 *     ONLY this directory plus the single forRoot() reference in AppModule.
 */
@Module({})
export class TestFixturesModule {
  static forRoot(): DynamicModule {
    if (process.env['E2E_TEST_MODE'] !== 'true') {
      // Empty module — controllers/services not registered, routes 404.
      return { module: TestFixturesModule };
    }
    return {
      module: TestFixturesModule,
      imports: [PrismaModule],
      controllers: [TestFixturesController],
      providers: [TestFixturesService, TotpEncryptionService],
    };
  }
}
