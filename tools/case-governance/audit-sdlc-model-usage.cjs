const fs = require('node:fs');
const path = require('node:path');

const sessionsRoot = process.argv[2];
if (!sessionsRoot) {
  console.error('Usage: node audit-sdlc-model-usage.cjs <sessions-root>');
  process.exit(2);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : entry.name.endsWith('.jsonl') ? [full] : [];
  });
}

const rows = [];
for (const file of walk(sessionsRoot)) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
  let meta;
  const models = new Set();
  const efforts = new Set();
  let lastUsage;

  for (const line of lines) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event.type === 'session_meta') meta = event.payload;
    if (event.type === 'turn_context') {
      if (event.payload?.model) models.add(event.payload.model);
      if (event.payload?.effort) efforts.add(event.payload.effort);
    }
    const usage = event.payload?.type === 'token_count'
      ? event.payload?.info?.total_token_usage
      : undefined;
    if (usage) lastUsage = usage;
  }

  const agent = meta?.agent_path || meta?.source?.subagent?.thread_spawn?.agent_path || '/root';
  if (!meta || !agent.startsWith('/root/case_')) continue;
  rows.push({
    agent,
    startedAt: meta.timestamp,
    models: [...models].sort(),
    efforts: [...efforts].sort(),
    inputTokens: lastUsage?.input_tokens || 0,
    cachedInputTokens: lastUsage?.cached_input_tokens || 0,
    outputTokens: lastUsage?.output_tokens || 0,
    reasoningOutputTokens: lastUsage?.reasoning_output_tokens || 0,
    totalTokens: lastUsage?.total_tokens || 0,
    file: path.basename(file),
  });
}

rows.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
const totals = rows.reduce((sum, row) => {
  for (const key of ['inputTokens', 'cachedInputTokens', 'outputTokens', 'reasoningOutputTokens', 'totalTokens']) {
    sum[key] += row[key];
  }
  return sum;
}, { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningOutputTokens: 0, totalTokens: 0 });

process.stdout.write(`${JSON.stringify({ generatedAt: new Date().toISOString(), sessionCount: rows.length, totals, rows }, null, 2)}\n`);
