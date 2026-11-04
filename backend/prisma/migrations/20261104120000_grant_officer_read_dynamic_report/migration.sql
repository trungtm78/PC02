-- OFFICER may open the dynamic-report module (the menu entries and their lists).
--
-- The permission seed already grants this, but the deploy never runs the seed, so on production the OFFICER role never
-- got it: officers named as the people who enter or review a report could not reach the screens they were assigned to.
-- Which report an officer sees is still decided by the module's own assignments (manager / editor), never by this
-- grant; `manage` and `admin` stay with ADMIN.
--
-- Idempotent, and does nothing when the role or the permission does not exist yet (a database the seed has not reached).
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."action" = 'read' AND p."subject" = 'DynamicReport'
WHERE r."name" = 'OFFICER'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
