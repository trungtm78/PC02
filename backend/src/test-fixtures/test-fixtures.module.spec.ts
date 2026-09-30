jest.mock('./test-fixtures.controller', () => ({
  TestFixturesController: class TestFixturesController {},
}));
jest.mock('./test-fixtures.service', () => ({
  TestFixturesService: class TestFixturesService {},
}));
jest.mock('../auth/services/totp-encryption.service', () => ({
  TotpEncryptionService: class TotpEncryptionService {},
}));

import { SettingsModule } from '../settings/settings.module';
import { TestFixturesModule } from './test-fixtures.module';

describe('TestFixturesModule', () => {
  const originalMode = process.env['E2E_TEST_MODE'];

  afterEach(() => {
    if (originalMode === undefined) {
      delete process.env['E2E_TEST_MODE'];
    } else {
      process.env['E2E_TEST_MODE'] = originalMode;
    }
  });

  it('imports SettingsModule when fixtures are enabled', () => {
    process.env['E2E_TEST_MODE'] = 'true';

    const fixtureModule = TestFixturesModule.forRoot();

    expect(fixtureModule.imports).toContain(SettingsModule);
  });
});
