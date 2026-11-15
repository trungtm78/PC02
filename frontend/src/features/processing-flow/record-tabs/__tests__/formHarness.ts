/** What the three form tests share: a signed-in profile with chosen permissions, the switch on or off, and the flow the server would answer. */
import { authStore, type AuthUser } from '@/stores/auth.store';
import { recFlow } from './fixtures';

export const READ_STEP = 'read:ProcessingStep';

export function signIn(permissions: string[]): void {
  const profile: AuthUser = {
    id: 'u1',
    email: 'a@b.com',
    username: 'a',
    firstName: 'A',
    lastName: 'B',
    role: 'OFFICER',
    canDispatch: false,
    teams: [{ teamId: 'team-doi-1', teamName: 'Đội 1', isLeader: true }],
    primaryTeam: { teamId: 'team-doi-1', teamName: 'Đội 1' },
    permissions,
  };
  authStore.setProfile(profile);
}

/** What the mocked API answers for the two record tabs, and the paths asked for. */
export function recordApiAnswer(url: string, kind: string, recordId: string) {
  if (url === `/processing/records/${kind}/${recordId}`) return { data: recFlow({ recordKind: kind, recordId }) };
  if (url.startsWith(`/processing/records/${kind}/${recordId}/steps/`)) return { data: { reports: [], opinions: [] } };
  return null;
}
