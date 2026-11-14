/**
 * Writes the processing-flow codes for the web and for Flutter: the SAME JSON in both places, from the one list in
 * `src/processing-flow/contract/processing-codes.ts`.
 *
 * Run: `npm run gen:processing-codes` (also part of `npm run build`).
 * Gate: `src/processing-flow/contract/processing-codes.spec.ts` fails when a generated file was edited by hand or the
 * list changed without re-running this.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PROCESSING_CODES_TARGETS, renderProcessingCodes } from '../src/processing-flow/contract/processing-codes';

const ROOT = path.resolve(__dirname, '..', '..');

export function writeProcessingCodes(root: string = ROOT): string[] {
  const text = renderProcessingCodes();
  return PROCESSING_CODES_TARGETS.map((target) => {
    const file = path.join(root, target);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text, 'utf8');
    return target;
  });
}

if (require.main === module) {
  for (const target of writeProcessingCodes()) console.log(`[gen-processing-codes] -> ${target}`);
}
