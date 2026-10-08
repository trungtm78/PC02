import { DocumentsModule } from './documents.module';
import { CaseEvidenceGovernanceModule } from '../cases/evidence-governance/evidence-governance.module';
import { CaseGovernanceFoundationModule } from '../cases/governance/case-governance-foundation.module';
describe('ordinary Document byte authorization dependency graph', () => {
  it('loads the evidence/foundation path without circular module imports', () => {
    const visited = new Set<unknown>();
    function visit(module: unknown, stack: Set<unknown>): void {
      if (typeof module !== 'function') return;
      expect(stack.has(module)).toBe(false);
      if (visited.has(module)) return;
      visited.add(module);
      const next = new Set(stack);
      next.add(module);
      const imports = Reflect.getMetadata('imports', module) as
        | unknown[]
        | undefined;
      for (const dependency of imports ?? []) visit(dependency, next);
    }
    visit(DocumentsModule, new Set());
    expect(visited.has(CaseEvidenceGovernanceModule)).toBe(true);
    expect(visited.has(CaseGovernanceFoundationModule)).toBe(true);
  });
});
