-- A reach "exactly the team + the person's own records" (TEAM_OWN), between TEAM and TEAM_TREE
-- (prisma/permission-resources.ts). Only an addition: nobody's reach changes until a template says TEAM_OWN.

-- AlterEnum
ALTER TYPE "PermissionReach" ADD VALUE 'TEAM_OWN' AFTER 'TEAM';
