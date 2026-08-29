// Jest config cho vòng mutation KPI — chỉ nạp specs của module kpi để vòng chạy không kéo cả kho.
module.exports = {
  rootDir: 'src',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: 'kpi/.*\.spec\.ts$',
  transform: { '^.+\.(t|j)s$': ['ts-jest', { isolatedModules: true }] },
  transformIgnorePatterns: ['node_modules/(?!(@otplib|@noble)/)'],
  moduleNameMapper: { '^src/(.*)$': '<rootDir>/$1' },
};
