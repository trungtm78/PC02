-- C1 fix: force token invalidation after JwtStrategy hardening.
--
-- The previous JwtStrategy.validate() only rejected `type=refresh` tokens.
-- Pending tokens (`2fa_pending`, `change_password_pending`) could be presented
-- as Authorization: Bearer to call business APIs. The new validate() rejects
-- any non-access typed token, but currently-issued access tokens are still
-- valid. This bump invalidates them so all users re-login through the fixed
-- code path on first request.
--
-- Operational impact: every currently-logged-in user will be forced to
-- re-authenticate ONCE after deploy. Acceptable for an internal system.
-- Coordinate with the deploy notes.

UPDATE "users" SET "tokenVersion" = "tokenVersion" + 1;
