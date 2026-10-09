import * as fs from 'fs';
import * as path from 'path';

/**
 * Gate for design spec §10 R2: the dynamic-reports engine is shared
 * verbatim with the frontend via `npm run gen:dr-engine`. Two invariants:
 *
 * (a) Byte equality — frontend/src/features/dynamic-reports/engine/generated/*
 *     must be an exact copy of backend/src/dynamic-reports/engine/*.ts
 *     (excluding *.spec.ts). If this fails, someone edited the generated
 *     copy directly, or forgot to re-run `npm run gen:dr-engine` after
 *     changing an engine file — run that command and commit the result.
 *
 * (b) Import boundary — no engine file may import `@nestjs/*`, `@prisma/*`,
 *     `fs`, `path`, or any other Node-only/NestJS-only module. The engine
 *     must stay runnable unmodified in a Vite/browser bundle.
 */

const SRC_DIR = path.resolve(__dirname); // backend/src/dynamic-reports/engine
const GENERATED_DIR = path.resolve(
  __dirname,
  '..', '..', '..', '..', // src/dynamic-reports/engine -> src -> backend -> repo root
  'frontend', 'src', 'features', 'dynamic-reports', 'engine', 'generated',
);

const DISALLOWED_IMPORT_RE = /from\s+['"](@nestjs|@prisma|fs|path|net|http|crypto)(\/|['"])/;

function listEngineSourceFiles(): string[] {
  return fs
    .readdirSync(SRC_DIR)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'))
    .sort();
}

describe('gen-dr-engine gate (design spec §10 R2)', () => {
  const sourceFiles = listEngineSourceFiles();

  it('found at least the expected engine files (sanity check that this gate is actually scanning something)', () => {
    expect(sourceFiles.length).toBeGreaterThanOrEqual(9);
  });

  it('the generated frontend directory exists (run `npm run gen:dr-engine` if this fails)', () => {
    expect(fs.existsSync(GENERATED_DIR)).toBe(true);
  });

  for (const name of listEngineSourceFiles()) {
    it(`${name}: frontend generated copy is byte-identical to the backend source`, () => {
      const srcContent = fs.readFileSync(path.join(SRC_DIR, name), 'utf-8');
      const generatedPath = path.join(GENERATED_DIR, name);
      expect(fs.existsSync(generatedPath)).toBe(true);
      const generatedContent = fs.readFileSync(generatedPath, 'utf-8');
      expect(generatedContent).toBe(srcContent);
    });

    it(`${name}: does not import any NestJS/Prisma/Node-only module`, () => {
      const content = fs.readFileSync(path.join(SRC_DIR, name), 'utf-8');
      const match = DISALLOWED_IMPORT_RE.exec(content);
      expect(match).toBeNull();
    });
  }

  it('the generated directory has no orphaned file without a matching backend source', () => {
    const generatedFiles = fs
      .readdirSync(GENERATED_DIR)
      .filter((name) => name.endsWith('.ts'))
      .sort();
    expect(generatedFiles).toEqual(sourceFiles);
  });
});
