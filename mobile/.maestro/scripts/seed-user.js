const response = http.post(FIXTURE_API_BASE_URL + '/test/seed-user', {
  headers: {
    'x-test-seed-token': FIXTURE_TOKEN,
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    email: FIXTURE_EMAIL,
    password: FIXTURE_PASSWORD,
    mustChangePassword: FIXTURE_MUST_CHANGE_PASSWORD === 'true',
    twoFaEnabled: FIXTURE_TWO_FA_ENABLED === 'true',
    bumpTokenVersion: FIXTURE_BUMP_TOKEN_VERSION === 'true',
  }),
});

if (response.status !== 200) {
  throw new Error(
    'seed failed: ' + response.status + ' ' + response.body,
  );
}

const data = json(response.body);
if (FIXTURE_REQUIRE_OTP === 'true') {
  if (!data.currentTotpCode || data.currentTotpCode.length !== 6) {
    throw new Error('seed response missing currentTotpCode');
  }
  output.otp = data.currentTotpCode;
}
