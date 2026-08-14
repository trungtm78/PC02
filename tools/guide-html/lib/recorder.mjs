/**
 * Guide recorder — drives the real UI, creates the data, captures the shots.
 *
 * Every record in the finished guide was typed into a form and submitted the
 * way a duty officer would type and submit it. Nothing is inserted into the
 * database, and nothing is drawn by hand: if a screenshot shows a petition
 * number, that number was allocated by the server during this run.
 *
 * That constraint is the point. A guide illustrated with mock-ups drifts away
 * from the product silently — the screenshot keeps looking right long after
 * the screen it describes has changed. A guide that has to walk the flow to
 * produce its own images fails loudly the moment the flow breaks, which is
 * exactly when the guide was about to start lying.
 */
import fs from 'fs';
import path from 'path';

export class Recorder {
  constructor(page, { imgDir, log = console.log }) {
    this.page = page;
    this.imgDir = imgDir;
    this.log = log;
    this.steps = [];
    this.facts = {};
    this.failures = [];
    fs.mkdirSync(imgDir, { recursive: true });
  }

  /** Remember something the run produced (a petition number, a case code…). */
  fact(key, value) {
    this.facts[key] = value;
    this.log(`    · ${key} = ${value}`);
    return value;
  }

  /**
   * One documented step: do the thing, then photograph the result.
   *
   * `body` returns optional extra detail for the guide. A step that throws is
   * recorded as failed and the run continues — a guide that stops at the first
   * broken screen tells you less than one that shows you all of them.
   */
  async step({ id, chapter, title, why, how, selector, fullPage = false, settle = 900 }, body) {
    this.log(`  [${id}] ${title}`);
    const shot = `${id}.png`;
    const entry = { id, chapter, title, why, how, image: shot };
    try {
      if (body) {
        const extra = await body(this.page, this);
        if (extra && typeof extra === 'object') Object.assign(entry, extra);
      }
      await this.page.waitForTimeout(settle);
      const target = selector ? this.page.locator(selector).first() : this.page;
      await target.screenshot({ path: path.join(this.imgDir, shot), ...(selector ? {} : { fullPage }) });
      entry.ok = true;
    } catch (err) {
      entry.ok = false;
      entry.error = String(err && err.message ? err.message : err).split('\n')[0].slice(0, 300);
      this.log(`      ✗ ${entry.error}`);
      this.failures.push({ id, title, error: entry.error });
      try {
        await this.page.screenshot({ path: path.join(this.imgDir, shot), fullPage: false });
      } catch { /* the page may be gone; the guide will show the step as failed */ }
    }
    this.steps.push(entry);
    return entry;
  }
}

/** Fill a field addressed by `data-testid`, failing loudly if it is not there. */
export async function fill(page, testid, value) {
  const el = page.locator(`[data-testid="${testid}"]`).first();
  await el.waitFor({ state: 'visible', timeout: 15000 });
  await el.fill(String(value));
}

/** Choose an option by visible label; falls back to the first real option. */
export async function choose(page, testid, label) {
  const el = page.locator(`[data-testid="${testid}"]`).first();
  await el.waitFor({ state: 'visible', timeout: 15000 });
  const options = await el.locator('option').all();
  for (const o of options) {
    const text = (await o.innerText()).trim();
    if (label && text.toLowerCase().includes(String(label).toLowerCase())) {
      await el.selectOption(await o.getAttribute('value'));
      return text;
    }
  }
  for (const o of options) {
    const value = await o.getAttribute('value');
    if (value) {
      await el.selectOption(value);
      return (await o.innerText()).trim();
    }
  }
  throw new Error(`no selectable option in ${testid}`);
}

/**
 * The criminal-code picker is a searchable dropdown, not a `<select>`: 316
 * offences under the 2015 Penal Code do not fit in a native list a duty officer
 * can scroll, and it defaults to filtering down to the ~135 that fall in this
 * unit's remit. It is driven the way a person drives it — open, type, click.
 */
export async function pickCrime(page, query) {
  await page.locator('[data-testid="field-crimeChinhId-trigger"]').first().click();
  await page.locator('[data-testid="field-crimeChinhId-dropdown"]').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('[data-testid="field-crimeChinhId-search"]').fill(query);
  await page.waitForTimeout(800);

  let option = page.locator('[data-testid^="field-crimeChinhId-option-"]').first();
  if (!(await option.count())) {
    // Not in the unit's default filter — widen to the whole code, the way the
    // screen tells the user to ("Hiện tất cả").
    await page.locator('[data-testid="field-crimeChinhId-toggle-all"]').click();
    await page.waitForTimeout(800);
    option = page.locator('[data-testid^="field-crimeChinhId-option-"]').first();
  }
  await option.waitFor({ state: 'visible', timeout: 10000 });
  const label = (await option.innerText()).trim().replace(/\s+/g, ' ');
  await option.click();
  await page.waitForTimeout(500);
  return label;
}

/**
 * The shared FK picker (`FKSelection`): a wrapper with a trigger, a search box
 * and a result list. Used for "Điều tra viên chính" and friends. Picks the
 * first real result, which is enough for a walkthrough — the point of the shot
 * is the flow, not which officer got the file.
 */
export async function pickFk(page, wrapperTestId) {
  const wrap = page.locator(`[data-testid="${wrapperTestId}"]`).first();
  await wrap.waitFor({ state: 'visible', timeout: 15000 });
  await wrap.click();
  await page.waitForTimeout(700);
  const option = page
    .locator(`[data-testid^="${wrapperTestId}-option"], [data-testid="${wrapperTestId}"] li, [role="option"]`)
    .first();
  if (await option.count()) {
    const label = (await option.innerText()).trim().replace(/\s+/g, ' ').slice(0, 60);
    await option.click();
    await page.waitForTimeout(400);
    return label;
  }
  // Some builds render a plain <select> behind the same wrapper.
  const select = wrap.locator('select').first();
  if (await select.count()) {
    const values = await select.locator('option').all();
    for (const o of values) {
      const v = await o.getAttribute('value');
      if (v) { await select.selectOption(v); return (await o.innerText()).trim(); }
    }
  }
  throw new Error(`no option offered by ${wrapperTestId}`);
}
