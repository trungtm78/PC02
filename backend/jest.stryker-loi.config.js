// Jest config cho vòng mutation phủ MODULE LÕI (ngoài legacy-migration đã có sẵn).
// Chỉ nạp specs của đúng những module bị mutate, để vòng mutation không kéo cả 282 suite.
module.exports = {
  rootDir: 'src',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '(common/utils|document-numbers|incidents|kpi)/.*\.spec\.ts$',
  transform: { '^.+\.(t|j)s$': ['ts-jest', { isolatedModules: true }] },
  transformIgnorePatterns: ['node_modules/(?!(@otplib|@noble)/)'],
  moduleNameMapper: { '^src/(.*)$': '<rootDir>/$1' },
};
