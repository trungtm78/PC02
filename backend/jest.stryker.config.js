// Jest config riêng cho Stryker — chỉ chạy specs của module legacy-migration
// (bao phủ đủ 2 file mutate: legacy-mapper.ts + migration-report.ts), tăng tốc mutation.
module.exports = {
  rootDir: 'src',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: 'legacy-migration/.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': ['ts-jest', { isolatedModules: true }] },
  transformIgnorePatterns: ['node_modules/(?!(@otplib|@noble)/)'],
};
