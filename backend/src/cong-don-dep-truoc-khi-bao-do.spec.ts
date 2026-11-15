import * as fs from 'fs';
import * as path from 'path';

/**
 * GATE: the housekeeping of `deploy.sh` (old releases, old pre-deploy backups) runs BEFORE the step that may end the
 * script red.
 *
 * The prune used to come after the red exit of step 9d. From the day the search shadow columns needed a backfill every
 * deploy ended red there, and the prune never ran: measured on production 15/11/2026, 60 releases and 447 pre-deploy
 * backups, the disk at 84%. Nobody was told. This gate keeps the order, and keeps a retention rule on the backups.
 */
const DEPLOY_SH = path.resolve(__dirname, '../../scripts/deploy/deploy.sh');
const script = (): string => fs.readFileSync(DEPLOY_SH, 'utf8');

/** The line of the red exit of step 9d: the first `exit 1` after its heading. */
function redExitAt(text: string): number {
  const heading = text.indexOf('# 9d.');
  expect(heading).toBeGreaterThan(-1);
  const exit = text.indexOf('\n    exit 1\n', heading);
  expect(exit).toBeGreaterThan(heading);
  return exit;
}

describe('GATE — deploy.sh cleans up before it may end red', () => {
  it('the detector finds the red exit of step 9d', () => {
    expect(redExitAt(script())).toBeGreaterThan(0);
  });

  it('old releases are pruned before the red exit, and nowhere after it', () => {
    const text = script();
    const prune = text.indexOf('Pruning $PRUNE old releases');
    expect(prune).toBeGreaterThan(-1);
    expect(prune).toBeLessThan(redExitAt(text));
    expect(text.indexOf('Pruning $PRUNE old releases', redExitAt(text))).toBe(-1);
  });

  it('the release being deployed is never among the pruned ones', () => {
    const line = script()
      .split('\n')
      .find((l) => l.includes('tail -n "$PRUNE"'));
    expect(line).toBeDefined();
    expect(line).toContain('$RELEASE_SHA');
  });

  it('pre-deploy backups have a retention rule (newest 30 + the first of every day), before the red exit', () => {
    const text = script();
    const rule = text.indexOf('BACKUP_KEEP=');
    expect(rule).toBeGreaterThan(-1);
    expect(rule).toBeLessThan(redExitAt(text));
    expect(text).toContain('tail -n 30');
    // Only files with the pre-deploy name are considered: anything else in the directory is left alone.
    expect(text).toMatch(/grep -E '\^pre-deploy-\[0-9a-f\]\+-\[0-9\]\{8\}_\[0-9\]\{6\}/);
  });
});
