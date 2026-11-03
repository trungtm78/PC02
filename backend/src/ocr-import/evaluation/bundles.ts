/** Names stamped within this many milliseconds of the previous one belong to the same bundle of scans. */
const SAME_BUNDLE_MS = 2000;

/**
 * Groups scan files into bundles by the millisecond timestamp at the start of their name (the way a phone or a scanner
 * app names a batch it saved together). A name without one is a bundle of its own.
 */
export function groupBundles(names: readonly string[]): string[][] {
  const stamped = names
    .map((name) => ({ name, at: /^(\d{12,})_/.exec(name)?.[1] }))
    .sort((a, b) =>
      (a.at ?? a.name).localeCompare(b.at ?? b.name, 'en', { numeric: true }),
    );
  const bundles: string[][] = [];
  let last: number | null = null;
  for (const { name, at } of stamped) {
    const time = at === undefined ? null : Number(at);
    if (time === null || last === null || time - last > SAME_BUNDLE_MS)
      bundles.push([]);
    bundles[bundles.length - 1].push(name);
    last = time;
  }
  return bundles;
}

/** `--name value` pairs and bare `--switch` flags. */
export function parseArgs(
  argv: readonly string[],
): Record<string, string | true> {
  const args: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--'))
      throw new Error(`unexpected argument: ${token}`);
    const name = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) args[name] = true;
    else {
      args[name] = next;
      i += 1;
    }
  }
  return args;
}
