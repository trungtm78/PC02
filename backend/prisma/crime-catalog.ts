// Master tội danh BLHS 2015 — builder thuần (testable) từ data thô.
// Gán chương + cờ pc02Relevant theo dải số Điều. Dùng bởi seed-crimes-blhs2015.ts.
import { RAW_BLHS_2015_CRIMES } from './data/blhs2015-crimes';

export interface CatalogCrime {
  code: string; // D{articleNo} — vd D123
  name: string; // "Tội giết người"
  articleNo: number; // số Điều BLHS 2015
  chapter: string; // chương La Mã (XIII..XXVI)
  pc02Relevant: boolean; // thuộc phạm vi PC02 (tội phạm trật tự xã hội)
  legacyValue: number; // value gốc hệ thống cũ — để map khi di trú
  order: number; // = articleNo (sắp theo số điều)
  isActive: boolean;
}

// Dải số Điều → chương BLHS 2015 (Phần thứ hai — Các tội phạm).
// [from, to, chapter]
const CHAPTER_RANGES: ReadonlyArray<readonly [number, number, string]> = [
  [108, 122, 'XIII'], // Các tội xâm phạm an ninh quốc gia
  [123, 156, 'XIV'], // Xâm phạm tính mạng, sức khỏe, nhân phẩm, danh dự
  [157, 167, 'XV'], // Xâm phạm quyền tự do của con người
  [168, 180, 'XVI'], // Xâm phạm sở hữu
  [181, 187, 'XVII'], // Xâm phạm chế độ hôn nhân và gia đình
  [188, 234, 'XVIII'], // Xâm phạm trật tự quản lý kinh tế
  [235, 246, 'XIX'], // Tội phạm về môi trường
  [247, 259, 'XX'], // Tội phạm về ma túy
  [260, 329, 'XXI'], // Xâm phạm an toàn công cộng, trật tự công cộng
  [330, 351, 'XXII'], // Xâm phạm trật tự quản lý hành chính
  [352, 366, 'XXIII'], // Các tội phạm về chức vụ
  [367, 391, 'XXIV'], // Xâm phạm hoạt động tư pháp
  [392, 420, 'XXV'], // Xâm phạm nghĩa vụ, trách nhiệm của quân nhân
  [421, 425, 'XXVI'], // Phá hoại hòa bình, chống loài người, tội phạm chiến tranh
];

// Chương thuộc phạm vi điều tra của PC02 (Cảnh sát điều tra tội phạm về trật tự xã hội).
const PC02_CHAPTERS = new Set(['XIV', 'XV', 'XVI', 'XVII', 'XXI']);

export function chapterForArticle(articleNo: number): string {
  for (const [from, to, chapter] of CHAPTER_RANGES) {
    if (articleNo >= from && articleNo <= to) return chapter;
  }
  return 'KHAC';
}

export function buildCrimeCatalog(): CatalogCrime[] {
  return RAW_BLHS_2015_CRIMES.map((raw) => {
    const chapter = chapterForArticle(raw.articleNo);
    return {
      code: `D${raw.articleNo}`,
      name: raw.name,
      articleNo: raw.articleNo,
      chapter,
      pc02Relevant: PC02_CHAPTERS.has(chapter),
      legacyValue: raw.legacyValue,
      order: raw.articleNo,
      isActive: true,
    };
  });
}
