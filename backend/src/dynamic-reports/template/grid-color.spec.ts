import { INDEXED_PALETTE, applyTint, parseThemeColors, resolveColor } from './grid-color';

/**
 * Expected values here are the swatches Excel itself shows in its colour
 * picker (Office 2007–2010 theme), written down from the application — not
 * produced by running this module. Excel works in a 0–240 integer HLS space,
 * so each channel may differ from a float computation by one unit.
 */

const OFFICE_THEME = `<?xml version="1.0"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:themeElements><a:clrScheme name="Office"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F497D"/></a:dk2><a:lt2><a:srgbClr val="EEECE1"/></a:lt2><a:accent1><a:srgbClr val="4F81BD"/></a:accent1><a:accent2><a:srgbClr val="C0504D"/></a:accent2><a:accent3><a:srgbClr val="9BBB59"/></a:accent3><a:accent4><a:srgbClr val="8064A2"/></a:accent4><a:accent5><a:srgbClr val="4BACC6"/></a:accent5><a:accent6><a:srgbClr val="F79646"/></a:accent6><a:hlink><a:srgbClr val="0000FF"/></a:hlink><a:folHlink><a:srgbClr val="800080"/></a:folHlink></a:clrScheme></a:themeElements></a:theme>`;

function near(actual: string, expected: string, slack = 1): void {
  const a = actual.replace('#', '');
  const e = expected.replace('#', '');
  for (let i = 0; i < 6; i += 2) {
    const da = parseInt(a.slice(i, i + 2), 16);
    const de = parseInt(e.slice(i, i + 2), 16);
    expect(Math.abs(da - de)).toBeLessThanOrEqual(slack);
  }
}

describe('parseThemeColors', () => {
  const theme = parseThemeColors(OFFICE_THEME);

  it('orders the slots the way a cell style counts them (lt1, dk1, lt2, dk2, accents…)', () => {
    expect(theme[0]).toBe('FFFFFF'); // theme="0" is the LIGHT 1 colour
    expect(theme[1]).toBe('000000'); // theme="1" is DARK 1
    expect(theme[2]).toBe('EEECE1');
    expect(theme[3]).toBe('1F497D');
    expect(theme[4]).toBe('4F81BD');
    expect(theme[9]).toBe('F79646');
    expect(theme[10]).toBe('0000FF');
    expect(theme[11]).toBe('800080');
  });

  it('reads system colours through lastClr', () => {
    expect(theme[1]).toBe('000000');
  });

  it('falls back to the Office palette when the workbook has no theme', () => {
    expect(parseThemeColors(undefined)[4]).toBe('4F81BD');
    expect(parseThemeColors('<broken')[4]).toBe('4F81BD');
  });
});

describe('applyTint — Excel colour-picker swatches', () => {
  it.each([
    ['4F81BD', 0.7999816888943144, 'DCE6F1'], // Blue, Accent 1, Lighter 80%
    ['4F81BD', 0.5999938962981048, 'B8CCE4'], // Lighter 60%
    ['4F81BD', 0.3999755851924192, '95B3D7'], // Lighter 40%
    ['4F81BD', -0.249977111117893, '366092'], // Darker 25%
    ['4F81BD', -0.499984740745262, '244062'], // Darker 50%
    ['FFFFFF', -0.0499893185216834, 'F2F2F2'], // White, Background 1, Darker 5%
    ['FFFFFF', -0.1499984740745262, 'D9D9D9'], // Darker 15%
    ['FFFFFF', -0.249977111117893, 'BFBFBF'], // Darker 25%
    ['FFFFFF', -0.499984740745262, '7F7F7F'], // Darker 50%
    ['000000', 0.499984740745262, '7F7F7F'], // Black, Text 1, Lighter 50%
    ['000000', 0.349986266670736, '595959'], // Lighter 35%
    ['000000', 0.249977111117893, '404040'], // Lighter 25%
    ['000000', 0.0499893185216834, '0D0D0D'], // Lighter 5%
    ['C0504D', 0.7999816888943144, 'F2DCDB'], // Red, Accent 2, Lighter 80%
    ['9BBB59', 0.3999755851924192, 'C3D69B'], // Olive Green, Accent 3, Lighter 40%
  ])('%s with tint %s → %s', (base, tint, expected) => {
    near(applyTint(base, tint), expected);
  });

  it('a zero tint changes nothing', () => {
    expect(applyTint('4f81bd', 0)).toBe('4F81BD');
  });
});

describe('resolveColor', () => {
  const ctx = { theme: parseThemeColors(OFFICE_THEME) };

  it('literal ARGB drops the alpha byte', () => {
    expect(resolveColor({ argb: 'FFFF0000' }, ctx)).toBe('#FF0000');
    expect(resolveColor({ argb: '00112233' }, ctx)).toBe('#112233'); // Excel ignores alpha
    expect(resolveColor({ argb: '336699' }, ctx)).toBe('#336699');
  });

  it('theme slot plus tint', () => {
    expect(resolveColor({ theme: 1 }, ctx)).toBe('#000000');
    expect(resolveColor({ theme: 0 }, ctx)).toBe('#FFFFFF');
    near(resolveColor({ theme: 4, tint: 0.7999816888943144 }, ctx) as string, 'DCE6F1');
  });

  it('indexed palette, including the system foreground/background entries', () => {
    expect(resolveColor({ indexed: 10 }, ctx)).toBe('#FF0000');
    expect(resolveColor({ indexed: 22 }, ctx)).toBe('#C0C0C0');
    expect(resolveColor({ indexed: 44 }, ctx)).toBe('#99CCFF');
    expect(resolveColor({ indexed: 64 }, ctx)).toBe('#000000');
    expect(resolveColor({ indexed: 65 }, ctx)).toBe('#FFFFFF');
    expect(INDEXED_PALETTE).toHaveLength(66);
  });

  it("a workbook's own indexed palette wins over the default", () => {
    const custom = [...INDEXED_PALETTE];
    custom[10] = '123456';
    expect(resolveColor({ indexed: 10 }, { ...ctx, indexed: custom })).toBe('#123456');
  });

  it('automatic / empty / out-of-range colours are undefined', () => {
    expect(resolveColor(undefined, ctx)).toBeUndefined();
    expect(resolveColor({}, ctx)).toBeUndefined();
    expect(resolveColor({ theme: 99 }, ctx)).toBeUndefined();
    expect(resolveColor({ indexed: 999 }, ctx)).toBeUndefined();
  });
});
