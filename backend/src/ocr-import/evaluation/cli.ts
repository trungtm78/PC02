/**
 * `npm run ocr:danh-gia` — reads bundles of scans with a real provider and scores the result against hand-checked
 * answers.
 *
 *   npm run ocr:danh-gia -- --dir <folder of scans> --out <folder for results> [--entity petition|incident|case]
 *       [--provider anthropic|gemini] [--model <id>] [--bundles 0,2] [--golden <file.json>] [--init-golden]
 *
 * The key comes from ANTHROPIC_API_KEY or GEMINI_API_KEY; it is never printed or written. Scans are personal data:
 * keep `--dir` and `--out` outside the repository. `--init-golden` writes what the system read as a DRAFT answer file
 * for a person to correct against the images; a score against an uncorrected draft only measures the system against
 * itself.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { AnthropicProvider } from '../../llm/anthropic.adapter';
import { GeminiProvider } from '../../llm/gemini.adapter';
import type { LlmProvider } from '../../llm/llm.types';
import type { Validation } from '../../llm/call-policy';
import type { FormEntity } from '../khai-o-form.generated';
import { runPipeline, type PageImage, type PipelineGateway } from '../pipeline';
import { ImageStorageService } from '../storage/image-storage.service';
import { groupBundles, parseArgs } from './bundles';
import {
  scoreCase,
  summarise,
  type CaseScore,
  type GoldenCase,
} from './scorer';

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const dir = typeof args.dir === 'string' ? args.dir : null;
  const out = typeof args.out === 'string' ? args.out : null;
  if (!dir || !out) {
    console.error(
      'usage: --dir <folder of scans> --out <folder for results> [options], see the header of cli.ts',
    );
    return 2;
  }
  const entity = (
    typeof args.entity === 'string' ? args.entity : 'petition'
  ) as FormEntity;
  const kind =
    typeof args.provider === 'string'
      ? args.provider
      : process.env.GEMINI_API_KEY
        ? 'gemini'
        : 'anthropic';
  const provider = buildProvider(
    kind,
    typeof args.model === 'string' ? args.model : undefined,
  );
  if (!provider) {
    console.error(
      `no key for provider "${kind}": set ${kind === 'gemini' ? 'GEMINI_API_KEY' : 'ANTHROPIC_API_KEY'}`,
    );
    return 2;
  }
  const only =
    typeof args.bundles === 'string'
      ? args.bundles.split(',').map(Number)
      : null;
  const golden =
    typeof args.golden === 'string'
      ? (JSON.parse(fs.readFileSync(args.golden, 'utf8')) as GoldenCase[])
      : [];

  fs.mkdirSync(out, { recursive: true });
  const bundles = groupBundles(
    fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)),
  );
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-eval-'));
  const storage = new ImageStorageService({ rootDir: scratch });
  let tokensIn = 0;
  let tokensOut = 0;
  let calls = 0;
  const gateway: PipelineGateway = {
    async call<T>(
      request: Parameters<LlmProvider['call']>[0],
      validate: (json: unknown) => Validation<T>,
    ) {
      const result = await provider.call(request);
      calls += 1;
      tokensIn += result.usage.inputTokens;
      tokensOut += result.usage.outputTokens;
      const checked = validate(result.json);
      if (!checked.ok)
        throw new Error(
          `reply did not match the schema: ${checked.issues.slice(0, 3).join(' | ')}`,
        );
      return { result, value: checked.value, attempts: [] };
    },
  };

  const scores: CaseScore[] = [];
  const draft: GoldenCase[] = [];
  const failures: string[] = [];
  try {
    for (const [index, files] of bundles.entries()) {
      if (only && !only.includes(index)) continue;
      const id = `bundle-${index}`;
      try {
        const pages: PageImage[] = [];
        for (const [n, file] of files.entries()) {
          const derived = await storage.deriveForProvider(
            fs.readFileSync(path.join(dir, file)),
          );
          pages.push({
            id: `p${n + 1}`,
            mediaType: derived.mediaType,
            dataBase64: derived.buffer.toString('base64'),
          });
        }
        const result = await runPipeline(gateway, {
          pages,
          entity,
          context: { userId: null, sessionRef: id },
        });
        fs.writeFileSync(
          path.join(out, `${id}.json`),
          JSON.stringify(result, null, 2),
        );
        draft.push({
          id,
          entity,
          fields: Object.fromEntries(
            result.projection.fills.map((f) => [f.field, String(f.value)]),
          ),
        });
        const answer = golden.find((g) => g.id === id);
        if (answer) scores.push(scoreCase(answer, result.projection));
        console.log(
          `${id}: ${files.length} pages, ${result.projection.fills.length} fields filled, ${result.issues.length} issues`,
        );
      } catch (error) {
        failures.push(id);
        console.log(`${id}: FAILED (${(error as Error).name})`);
      }
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }

  if (args['init-golden']) {
    fs.writeFileSync(
      path.join(out, 'golden.draft.json'),
      JSON.stringify(draft, null, 2),
    );
    console.log(
      `draft answers written to ${path.join(out, 'golden.draft.json')}: correct them against the images before scoring`,
    );
  }
  const summary = summarise(scores);
  fs.writeFileSync(
    path.join(out, 'report.json'),
    JSON.stringify(
      {
        provider: kind,
        model: provider.model,
        entity,
        summary,
        scores,
        failures,
        usage: { calls, tokensIn, tokensOut },
      },
      null,
      2,
    ),
  );
  console.log(
    `scored ${summary.cases} bundle(s): accuracy ${(summary.accuracy * 100).toFixed(1)}%, wrong ${summary.wrong}, missing ${summary.missing}, invented ${summary.invented}; ${calls} calls, ${tokensIn} tokens in, ${tokensOut} out`,
  );
  // An invented value is never acceptable: the exit code lets a script refuse the model.
  return summary.invented > 0 || failures.length > 0 ? 1 : 0;
}

function buildProvider(kind: string, model?: string): LlmProvider | null {
  if (kind === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    return apiKey
      ? new GeminiProvider({ apiKey, model: model ?? 'gemini-2.5-flash' })
      : null;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return apiKey
    ? new AnthropicProvider({ apiKey, model: model ?? 'claude-haiku-5-5' })
    : null;
}

if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error(`failed: ${(error as Error).message}`);
      process.exit(2);
    },
  );
}
