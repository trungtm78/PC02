// Logic thuần cho CrimeSelect — tách để TDD.
// Quy tắc: có search → tìm trên TOÀN BỘ (bỏ lọc PC02); không search → showAll ? tất cả : chỉ PC02.

export interface CrimeOption {
  id: string;
  code: string;
  name: string;
  pc02Relevant: boolean;
  articleNo: number;
}

const VN_MAP: Record<string, string> = {
  a: 'aàảãáạăằẳẵắặâầẩẫấậ',
  d: 'dđ',
  e: 'eèẻẽéẹêềểễếệ',
  i: 'iìỉĩíị',
  o: 'oòỏõóọôồổỗốộơờởỡớợ',
  u: 'uùủũúụưừửữứự',
  y: 'yỳỷỹýỵ',
};

function noDiacritics(str: string): string {
  let r = str.toLowerCase();
  for (const [latin, chars] of Object.entries(VN_MAP)) {
    for (const ch of chars) r = r.replaceAll(ch, latin);
  }
  return r;
}

function byArticle(a: CrimeOption, b: CrimeOption): number {
  return a.articleNo - b.articleNo;
}

export function visibleCrimes(
  all: CrimeOption[],
  opts: { search: string; showAll: boolean },
): CrimeOption[] {
  const q = opts.search.trim();
  if (q) {
    const nq = noDiacritics(q);
    return all
      .filter(
        (c) => noDiacritics(c.name).includes(nq) || noDiacritics(c.code).includes(nq),
      )
      .sort(byArticle);
  }
  const base = opts.showAll ? all : all.filter((c) => c.pc02Relevant);
  return [...base].sort(byArticle);
}
