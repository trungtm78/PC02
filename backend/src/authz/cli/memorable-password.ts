import { randomInt } from 'node:crypto';

/**
 * Passwords for the default accounts of the PC02 unit chart: easy to say over the phone and to type once, different
 * for every account, and not derivable from anything (the username, the unit, another account's password).
 *
 * Shape `Word-Word@1234`: two different words of the list below (common Vietnamese words written without diacritics,
 * so any keyboard types them) and four digits, all drawn with `crypto.randomInt`. That satisfies the password policy of
 * the app (an uppercase letter, a digit, one of `!@#$%^&*`: `STRONG_PASSWORD_REGEX`) and leaves 215 x 214 x 10 000 (about
 * 4.6e8) possibilities, which is enough for a password that must be changed at the first login (`mustChangePassword`).
 */
export const MEMORABLE_WORDS: readonly string[] = [
  // nature
  'Hoa', 'Sen', 'Bien', 'Nui', 'Song', 'Suoi', 'Mua', 'Nang', 'Gio', 'May', 'Trang', 'Sao', 'Lua', 'Dat', 'Cay', 'Rung',
  'Dong', 'Thac', 'Dao', 'Vinh', 'Ghenh', 'Bai', 'Cat', 'Suong', 'Tuyet', 'Bang', 'Troi', 'Khoi', 'Loc', 'Mam', 'Canh',
  'Nhanh', 'Goc', 'Hat', 'Qua', 'Trai', 'Vuon', 'Ruong', 'Thoc', 'Gao', 'Ngo', 'Khoai', 'Dau', 'Lac', 'Vung', 'Hanh',
  'Gung', 'Rieng', 'Que', 'Tieu', 'Chanh', 'Tre', 'Truc', 'Mai', 'Lan', 'Cuc', 'Hong', 'Hue', 'Tung', 'Bach', 'Liu',
  'Phong', 'Thong', 'Kim', 'Moc', 'Thuy', 'Duong', 'Lien', 'Thom', 'Muop', 'Bau', 'Dua', 'Cam', 'Quyt', 'Buoi', 'Xoai',
  'Mit', 'Mang', 'Nho', 'Tao', 'Chuoi', 'Vai', 'Nhan', 'Chom', 'Man', 'Coi', 'Reu', 'Lau', 'Say', 'Bong',
  // animals
  'Chim', 'Meo', 'Tho', 'Huou', 'Voi', 'Ngua', 'Trau', 'Vit', 'Hac', 'Cuu', 'Ong', 'Kien', 'Ech', 'Cua', 'Tom', 'Ngao',
  'Yen', 'Phuong', 'Rong', 'Quy', 'Bao', 'Gau', 'Soc', 'Cao', 'Nai', 'Rua', 'Sam', 'Cong', 'Seu', 'Cho',
  // things
  'Ban', 'Ghe', 'Den', 'Sach', 'But', 'Giay', 'Dep', 'Tui', 'Tau', 'Thuyen', 'Nha', 'Cau', 'San', 'Gieng',
  'Chuong', 'Trong', 'Dan', 'Ken', 'Nen', 'Guong', 'Luoc', 'Day', 'Chi', 'Gam', 'Non', 'Quat', 'Thung', 'Bat', 'Dia',
  'Thia', 'Coc', 'Chen', 'Noi', 'Chao', 'Bep', 'Tranh', 'Tem', 'Dien', 'Pho', 'Lang',
  // colours, metals, stones
  'Xanh', 'Vang', 'Tim', 'Nau', 'Bac', 'Ngoc', 'Thiec',
  // times and seasons
  'Xuan', 'Thu', 'Sang', 'Chieu', 'Dem', 'Ngay', 'Tuan', 'Nam', 'Tet', 'Hoi', 'Rang', 'Khuya',
  // qualities
  'Vui', 'Hien', 'Binh', 'Tuoi', 'Moi', 'Xinh', 'Ngot', 'Manh', 'Ben', 'Tot', 'Hay', 'Gioi', 'Khoe', 'Thanh',
  'Minh', 'Tam', 'Tin', 'Nghia', 'Duc', 'Tri', 'Dung', 'Phuc', 'Loi', 'Tai', 'Huy', 'Long', 'Hung', 'Quang',
  'Viet', 'Hai', 'Son', 'Lam', 'Khang', 'Thinh', 'Tien', 'Toan',
];

const SPECIAL = '@';

/** One password, `Word-Word@1234`, the two words different. `pick` is for tests only. */
export function memorablePassword(pick: (max: number) => number = randomInt): string {
  const first = pick(MEMORABLE_WORDS.length);
  let second = pick(MEMORABLE_WORDS.length - 1);
  if (second >= first) second += 1;
  const digits = String(pick(10_000)).padStart(4, '0');
  return `${MEMORABLE_WORDS[first]}-${MEMORABLE_WORDS[second]}${SPECIAL}${digits}`;
}

/** `count` passwords, all different from each other. */
export function memorablePasswords(count: number, make: () => string = () => memorablePassword()): string[] {
  const out = new Set<string>();
  for (let tries = 0; out.size < count; tries += 1) {
    if (tries > count * 100) throw new Error(`could not make ${count} distinct passwords`);
    out.add(make());
  }
  return [...out];
}
