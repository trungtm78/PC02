import { readFileSync } from 'node:fs';
import { join } from 'node:path';
describe('governance durable persistence contract', () => {
  const schema = readFileSync(
    join(__dirname, '../../../prisma/schema.prisma'),
    'utf8',
  );
  it('pins disposition receipt identity and exact byte/version facts with a restrictive Document FK', () => {
    const disposition = schema.match(
      /model CaseDispositionRequest \{[\s\S]*?\n\}/,
    )?.[0];
    for (const [field, type] of [
      ['receiptDocumentId', 'String'],
      ['receiptDocumentUpdatedAt', 'DateTime'],
      ['receiptSha256', 'String'],
      ['receiptByteLength', 'Int'],
    ])
      expect(disposition).toMatch(new RegExp(`${field}\\s+${type}\\?`));
    expect(disposition).toMatch(
      /receiptDocument\s+Document\?\s+@relation\("DispositionReceiptDocument",\s*fields:\s*\[receiptDocumentId\],\s*references:\s*\[id\],\s*onDelete:\s*Restrict\)/,
    );
  });
  it('separates legal phase and receipt, with unknown historical values nullable', () => {
    expect(schema).toMatch(/intakeStage\s+CaseIntakeStage\?/);
    expect(schema).toMatch(/investigationPhase\s+CaseInvestigationPhase\?/);
    expect(schema).toMatch(/governanceRevision\s+Int\s+@default\(0\)/);
  });
  it('persists scoped replay identity and immutable evidence provenance with restrictive FKs', () => {
    expect(schema).toContain(
      '@@unique([actorId, caseId, operation, requestKey])',
    );
    for (const name of [
      'CaseHandoff',
      'CaseGovernanceOperation',
      'CaseDecision',
      'CaseRuleVersion',
      'CaseAssetVersion',
      'CaseDisclosurePacket',
      'CaseRepresentationGrant',
    ]) {
      const block = schema.match(
        new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`),
      )?.[0];
      expect(block).toBeDefined();
      expect(block).not.toContain('onDelete: Cascade');
      expect(block).not.toContain('onDelete: SetNull');
    }
  });
  it('pins custom field definition on Case with a typed FK and permits optional grant expiry', () => {
    const caseBlock = schema.match(/model Case \{[\s\S]*?\n\}/)?.[0];
    expect(caseBlock).toMatch(/fieldDefinitionVersionId\s+String\?/);
    expect(caseBlock).toMatch(
      /fieldDefinitionVersion\s+CaseFieldDefinitionVersion\?/,
    );
    const grants = schema.match(
      /model CaseGovernanceGrant \{[\s\S]*?\n\}/,
    )?.[0];
    expect(grants).toMatch(/expiresAt\s+DateTime\?/);
  });
});
