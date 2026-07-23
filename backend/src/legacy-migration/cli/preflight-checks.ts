/**
 * Các phép kiểm CHẶN trước khi nạp. Hàm THUẦN, test được — phần lấy dữ liệu nằm ở preflight.ts.
 *
 * Triết lý: thà dừng lại và báo rõ còn hơn nạp xong mới phát hiện 53.820 hồ sơ sai ngày
 * hoặc vô chủ. Mỗi phát hiện có mức độ: BLOCK (không cho nạp) hoặc WARN (nạp được, ghi nhận).
 */

export type Severity = 'BLOCK' | 'WARN' | 'OK';

export interface CheckResult {
  id: string;
  title: string;
  severity: Severity;
  detail: string;
  samples?: string[];
}

/** Ngưỡng: giá trị đơn vị chưa phân loại mà từ ngần này hồ sơ trở lên thì chặn nạp. */
export const UNKNOWN_UNIT_BLOCK_THRESHOLD = 100;

/** Độ lệch đã chứng minh cho epoch giây của hệ cũ (xem parseLegacyDate). */
export const EXPECTED_EPOCH_REMAINDER = 36000; // 10:00 UTC

/**
 * Kiểm một trường ngày kiểu epoch có tuân theo cùng quy tắc lệch −14h hay không.
 *
 * Quy tắc chỉ được CHỨNG MINH cho `ngay_de_xuat` (trường duy nhất có cặp ngay/thang/nam
 * để đối chiếu). Với các trường ngày khác, dấu hiệu nhận biết là số dư `value % 86400`
 * phải đồng nhất bằng 36000. Trường nào không đồng nhất thì KHÔNG được áp cùng công thức,
 * vì áp bừa là lệch ngày hàng loạt mà không ai biết.
 */
export function checkEpochField(field: string, remainders: Map<number, number>): CheckResult {
  const total = [...remainders.values()].reduce((a, b) => a + b, 0);
  if (total === 0) {
    return { id: `epoch:${field}`, title: `Trường ngày ${field}`, severity: 'OK', detail: 'không có giá trị epoch nào' };
  }
  const matching = remainders.get(EXPECTED_EPOCH_REMAINDER) ?? 0;
  const pct = (100 * matching) / total;
  if (pct === 100) {
    return {
      id: `epoch:${field}`,
      title: `Trường ngày ${field}`,
      severity: 'OK',
      detail: `${total} giá trị, 100,00% có số dư ${EXPECTED_EPOCH_REMAINDER} — áp được công thức +50400s`,
    };
  }
  const others = [...remainders.entries()]
    .filter(([r]) => r !== EXPECTED_EPOCH_REMAINDER)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([r, n]) => `${r} (${n} giá trị)`);
  return {
    id: `epoch:${field}`,
    title: `Trường ngày ${field}`,
    severity: pct >= 99 ? 'WARN' : 'BLOCK',
    detail:
      `${total} giá trị nhưng chỉ ${pct.toFixed(2)}% có số dư ${EXPECTED_EPOCH_REMAINDER}. ` +
      `Áp công thức +50400s cho trường này sẽ lệch ngày. Số dư khác: ${others.join(', ')}`,
  };
}

/** Mọi legacyValue phải ánh xạ ĐÚNG MỘT tội danh — `Crime.legacyValue` chỉ là index, không unique. */
export function checkCrimeAmbiguity(counts: { legacyValue: number; crimes: number }[]): CheckResult {
  const dup = counts.filter((c) => c.crimes > 1);
  if (!dup.length) {
    return { id: 'crime:ambiguous', title: 'Tra tội danh', severity: 'OK', detail: 'mỗi mã tội danh cũ ứng đúng 1 tội danh mới' };
  }
  return {
    id: 'crime:ambiguous',
    title: 'Tra tội danh',
    severity: 'BLOCK',
    detail: `${dup.length} mã tội danh cũ ứng với NHIỀU tội danh mới → tra cứu sẽ lấy bừa`,
    samples: dup.slice(0, 10).map((d) => `mã ${d.legacyValue} → ${d.crimes} tội danh`),
  };
}

/** Mã tội danh dùng trong hồ sơ nhưng không có trong bảng tội danh hệ mới. */
export function checkCrimeCoverage(missing: { legacyValue: string; records: number }[]): CheckResult {
  if (!missing.length) {
    return { id: 'crime:coverage', title: 'Độ phủ tội danh', severity: 'OK', detail: 'mọi mã tội danh trong hồ sơ đều tra được' };
  }
  const records = missing.reduce((a, b) => a + b.records, 0);
  return {
    id: 'crime:coverage',
    title: 'Độ phủ tội danh',
    severity: 'BLOCK',
    detail: `${missing.length} mã tội danh không có trong bảng tội danh (ảnh hưởng ${records} hồ sơ) — chạy "npm run db:seed:crimes" trước`,
    samples: missing.slice(0, 10).map((m) => `mã ${m.legacyValue}: ${m.records} hồ sơ`),
  };
}

/** Đơn vị chưa phân loại: chặn nếu còn giá trị ảnh hưởng nhiều hồ sơ. */
export function checkUnknownUnits(unknowns: { sample: string; count: number }[]): CheckResult {
  const big = unknowns.filter((u) => u.count >= UNKNOWN_UNIT_BLOCK_THRESHOLD);
  const totalRecords = unknowns.reduce((a, b) => a + b.count, 0);
  if (!unknowns.length) {
    return { id: 'unit:unknown', title: 'Phân loại đơn vị', severity: 'OK', detail: 'mọi giá trị đơn vị đã được phân loại' };
  }
  return {
    id: 'unit:unknown',
    title: 'Phân loại đơn vị',
    severity: big.length ? 'BLOCK' : 'WARN',
    detail: big.length
      ? `${big.length} giá trị chưa phân loại mà mỗi giá trị từ ${UNKNOWN_UNIT_BLOCK_THRESHOLD} hồ sơ trở lên (tổng chưa phân loại: ${totalRecords} hồ sơ)`
      : `${unknowns.length} giá trị chưa phân loại nhưng đều lẻ tẻ (tổng ${totalRecords} hồ sơ) — nạp được, hồ sơ sẽ không có tổ`,
    samples: (big.length ? big : unknowns).slice(0, 10).map((u) => `${u.count} hồ sơ: ${u.sample}`),
  };
}

/** Hồ sơ không nhận diện được phân loại → không sinh được thực thể nào. */
export function checkUnclassifiedRecords(count: number, total: number): CheckResult {
  if (count === 0) {
    return { id: 'record:unclassified', title: 'Phân loại hồ sơ', severity: 'OK', detail: 'mọi hồ sơ đều sinh được thực thể' };
  }
  const pct = (100 * count) / (total || 1);
  return {
    id: 'record:unclassified',
    title: 'Phân loại hồ sơ',
    severity: pct >= 1 ? 'BLOCK' : 'WARN',
    detail: `${count}/${total} hồ sơ (${pct.toFixed(2)}%) không nhận diện được phân loại → sẽ bị bỏ qua khi nạp`,
  };
}

/** Quy tắc sinh khoá đổi giữa chừng thì mọi bản ghi đã nạp sẽ bị nhân đôi. */
export function checkKeyVersion(runVersion: string | null, currentVersion: string): CheckResult {
  if (!runVersion || runVersion === currentVersion) {
    return { id: 'run:keyVersion', title: 'Phiên bản khoá', severity: 'OK', detail: `khớp (${currentVersion})` };
  }
  return {
    id: 'run:keyVersion',
    title: 'Phiên bản khoá',
    severity: 'BLOCK',
    detail: `Bảng chờ được nạp bằng quy tắc khoá "${runVersion}" nhưng mã hiện tại dùng "${currentVersion}". Nạp tiếp sẽ NHÂN ĐÔI dữ liệu — phải nạp lại bảng chờ từ đầu.`,
  };
}

/** Tên/mã tổ trùng nhau thì `Team.name`/`Team.code` (@unique) sẽ ném lỗi giữa chừng. */
export function checkTeamUniqueness(names: string[], codes: string[]): CheckResult {
  const dupOf = (xs: string[]) => {
    const seen = new Set<string>();
    const dup = new Set<string>();
    for (const x of xs) (seen.has(x) ? dup : seen).add(x);
    return [...dup];
  };
  const dupNames = dupOf(names);
  const dupCodes = dupOf(codes);
  if (!dupNames.length && !dupCodes.length) {
    return { id: 'team:unique', title: 'Trùng tên/mã tổ', severity: 'OK', detail: `${names.length} tổ, không có tên hay mã nào trùng` };
  }
  return {
    id: 'team:unique',
    title: 'Trùng tên/mã tổ',
    severity: 'BLOCK',
    detail: `${dupNames.length} tên trùng, ${dupCodes.length} mã trùng — Team.name và Team.code đều là @unique`,
    samples: [...dupNames.map((n) => `tên: ${n}`), ...dupCodes.map((c) => `mã: ${c}`)].slice(0, 10),
  };
}

/** Gộp kết quả: có BLOCK nào thì không được nạp. */
export function summarize(results: CheckResult[]): { canProceed: boolean; blocks: number; warns: number } {
  const blocks = results.filter((r) => r.severity === 'BLOCK').length;
  const warns = results.filter((r) => r.severity === 'WARN').length;
  return { canProceed: blocks === 0, blocks, warns };
}
