/**
 * How deep "the teams under a team" goes: `TeamsService.getDescendantIds` and the permission engine
 * (`authz/engine/scope.ts`) both stop here, so "as today" means the same thing in both.
 *
 * In a file of its own on purpose: the engine is imported by the scope resolvers, which the teams module's own
 * dependencies import; importing the constant from `teams.service.ts` closed that circle and left a provider
 * undefined at start-up.
 */
export const TEAM_TREE_MAX_DEPTH = 3;
