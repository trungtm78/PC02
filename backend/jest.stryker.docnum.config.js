module.exports = {
  rootDir: 'src',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: 'document-numbers/(period-key|formula-engine|document-numbers\.expert).*\.spec\.ts$',
  transform: { '^.+\.(t|j)s$': ['ts-jest', { isolatedModules: true }] },
  transformIgnorePatterns: ['node_modules/(?!(@otplib|@noble)/)'],
};
