// Jest config cho Stryker — chỉ specs scope-filter (phủ scope-filter.util.ts).
module.exports = {
  rootDir: 'src',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: 'scope-filter\.util.*\.spec\.ts$',
  transform: { '^.+\.(t|j)s$': ['ts-jest', { isolatedModules: true }] },
  transformIgnorePatterns: ['node_modules/(?!(@otplib|@noble)/)'],
};
