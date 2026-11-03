import { Client } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Constraints of the LLM provider tables, ON REAL POSTGRESQL.
 *
 * Unit specs cannot prove what the database enforces: that only one active PRIMARY provider can exist, that a
 * role cannot be held without a passing key test, and that the lineage table has nowhere to put request content.
 *
 * Runs only with `PETITION_SUGGEST_DATABASE_URL` (127.0.0.1/pc02_goiy_scope_test), the same scratch database as the
 * other PostgreSQL specs; `PETITION_SUGGEST_DATABASE_REQUIRED=1` in CI turns a missing database into a failure.
 */
const url = process.env.PETITION_SUGGEST_DATABASE_URL;
const run = url ? describe : describe.skip;

if (process.env.PETITION_SUGGEST_DATABASE_REQUIRED === '1') {
  it('the scratch database is mandatory (PETITION_SUGGEST_DATABASE_URL)', () => {
    expect(url).toBeTruthy();
  });
}

run('llm provider tables on PostgreSQL', () => {
  let client: Client;
  const tag = `llm-${randomUUID().slice(0, 8)}`;

  const insertProvider = (
    id: string,
    role: 'PRIMARY' | 'FALLBACK' | 'OFF',
    fingerprint: string | null,
    archived = false,
  ) =>
    client.query(
      `INSERT INTO llm_providers
         (id, kind, label, "apiKeyEncrypted", "apiKeyLast4", model, role, "testedFingerprint", "archivedAt", "createdById", "updatedAt")
       VALUES ($1, 'ANTHROPIC', $2, 'v1:x:y:z', 'abcd', 'claude-haiku-5-5', $3::"LlmProviderRole", $4, $5, 'user-1', now())`,
      [id, tag, role, fingerprint, archived ? new Date() : null],
    );

  /** Postgres error code of a failing statement, or null when it succeeds. */
  const failureCode = async (statement: Promise<unknown>) => {
    try {
      await statement;
      return null;
    } catch (error) {
      return (error as { code?: string }).code ?? 'unknown';
    }
  };

  beforeAll(async () => {
    const parsed = new URL(url!);
    if (
      parsed.hostname !== '127.0.0.1' ||
      parsed.pathname !== '/pc02_goiy_scope_test'
    ) {
      throw new Error(
        'Refused: PETITION_SUGGEST_DATABASE_URL must point to 127.0.0.1/pc02_goiy_scope_test',
      );
    }
    client = new Client({ connectionString: url! });
    await client.connect();
    const exists = await client.query(
      `SELECT to_regclass('public.llm_providers') AS name`,
    );
    const sql = fs.readFileSync(
      path.join(
        __dirname,
        '../../prisma/migrations/20261103193000_llm_providers/migration.sql',
      ),
      'utf-8',
    );
    if (!(exists.rows[0] as { name: string | null }).name) {
      await client.query(sql);
    } else {
      // CI builds the tables with `prisma db push`, which cannot express the partial unique index and the CHECK
      // constraint. Apply that section of the REAL migration (idempotent) so the specs test the shipped SQL.
      const marker = '-- At most one active PRIMARY';
      expect(sql).toContain(marker);
      await client.query(sql.slice(sql.indexOf(marker)));
    }
  });

  afterEach(async () => {
    await client.query(`DELETE FROM llm_providers WHERE label = $1`, [tag]);
    await client.query(`DELETE FROM llm_call_lineage WHERE "sessionRef" = $1`, [
      tag,
    ]);
  });

  afterAll(async () => {
    await client.end();
  });

  it('allows one active PRIMARY and rejects a second one (unique violation)', async () => {
    await insertProvider(`${tag}-a`, 'PRIMARY', 'fp-a');
    expect(
      await failureCode(insertProvider(`${tag}-b`, 'PRIMARY', 'fp-b')),
    ).toBe('23505');
  });

  it('an archived PRIMARY does not count, so a new one can take over', async () => {
    await insertProvider(`${tag}-old`, 'PRIMARY', 'fp-old', true);
    expect(
      await failureCode(insertProvider(`${tag}-new`, 'PRIMARY', 'fp-new')),
    ).toBeNull();
  });

  it('any number of FALLBACK providers may coexist with the PRIMARY', async () => {
    await insertProvider(`${tag}-p`, 'PRIMARY', 'fp-p');
    expect(
      await failureCode(insertProvider(`${tag}-f1`, 'FALLBACK', 'fp-1')),
    ).toBeNull();
    expect(
      await failureCode(insertProvider(`${tag}-f2`, 'FALLBACK', 'fp-2')),
    ).toBeNull();
  });

  it('a role without a passing key test is rejected (check violation); OFF needs none', async () => {
    expect(await failureCode(insertProvider(`${tag}-x`, 'PRIMARY', null))).toBe(
      '23514',
    );
    expect(
      await failureCode(insertProvider(`${tag}-y`, 'FALLBACK', null)),
    ).toBe('23514');
    expect(
      await failureCode(insertProvider(`${tag}-z`, 'OFF', null)),
    ).toBeNull();
  });

  it('removing the test fingerprint from a provider that holds a role is rejected', async () => {
    await insertProvider(`${tag}-q`, 'FALLBACK', 'fp-q');
    expect(
      await failureCode(
        client.query(
          `UPDATE llm_providers SET "testedFingerprint" = NULL WHERE id = $1`,
          [`${tag}-q`],
        ),
      ),
    ).toBe('23514');
  });

  it('the lineage table has no column that could hold request or reply content', async () => {
    const columns = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'llm_call_lineage'`,
    );
    const names = columns.rows.map(
      (r) => (r as { column_name: string }).column_name,
    );
    expect(names.length).toBeGreaterThan(8);
    for (const name of names) {
      expect(name).not.toMatch(
        /prompt$|content|transcript|image|text|body|reply|response/i,
      );
    }
    expect(names).toContain('promptVersion');
  });

  it('lineage survives deleting the provider: it holds no foreign key to it', async () => {
    await insertProvider(`${tag}-gone`, 'OFF', null);
    await client.query(
      `INSERT INTO llm_call_lineage (id, "sessionRef", "providerId", "providerKind", model, outcome)
       VALUES ($1, $2, $3, 'ANTHROPIC', 'claude-haiku-5-5', 'OK')`,
      [`${tag}-line`, tag, `${tag}-gone`],
    );
    await client.query(`DELETE FROM llm_providers WHERE id = $1`, [
      `${tag}-gone`,
    ]);
    const rows = await client.query(
      `SELECT "providerId" FROM llm_call_lineage WHERE id = $1`,
      [`${tag}-line`],
    );
    expect(rows.rowCount).toBe(1);
  });
});
