import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { decodeDocument, readBsonFile, countBsonDocuments, BsonParseError } from './bson-reader';

/**
 * Test dựng file BSON THẬT bằng bộ mã hoá tối giản ngay trong test, rồi đọc lại.
 * Không mock — nếu bộ đọc sai một byte offset là test đổ.
 */

// ── bộ mã hoá tối giản, chỉ đủ dựng dữ liệu test ───────────────────────────
function cstring(s: string): Buffer {
  return Buffer.concat([Buffer.from(s, 'utf8'), Buffer.from([0])]);
}
function elem(type: number, key: string, payload: Buffer): Buffer {
  return Buffer.concat([Buffer.from([type]), cstring(key), payload]);
}
function bstring(s: string): Buffer {
  const b = Buffer.from(s, 'utf8');
  const len = Buffer.alloc(4);
  len.writeInt32LE(b.length + 1);
  return Buffer.concat([len, b, Buffer.from([0])]);
}
function int32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeInt32LE(n);
  return b;
}
function int64(n: number): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigInt64LE(BigInt(n));
  return b;
}
function doc(elems: Buffer[]): Buffer {
  const body = Buffer.concat(elems);
  const len = Buffer.alloc(4);
  len.writeInt32LE(body.length + 5);
  return Buffer.concat([len, body, Buffer.from([0])]);
}

const tmpFile = (name: string) => path.join(os.tmpdir(), `pc02-bson-${process.pid}-${name}.bson`);

describe('decodeDocument — các kiểu có thật trong dump', () => {
  it('đọc chuỗi, int32, int64, boolean, null', () => {
    const b = doc([
      elem(0x02, 'ten', bstring('Đội 8')),
      elem(0x10, 'id', int32(53820)),
      elem(0x12, 'ngay_de_xuat', int64(1488967200)),
      elem(0x08, 'da_xoa', Buffer.from([0])),
      elem(0x0a, 'ghi_chu', Buffer.alloc(0)),
    ]);
    expect(decodeDocument(b).value).toEqual({
      ten: 'Đội 8',
      id: 53820,
      ngay_de_xuat: 1488967200,
      da_xoa: false,
      ghi_chu: null,
    });
  });

  it('giữ nguyên dấu tiếng Việt (UTF-8 nhiều byte)', () => {
    const b = doc([elem(0x02, 'ten', bstring('Công an Phường Bàn Cờ'))]);
    expect(decodeDocument(b).value.ten).toBe('Công an Phường Bàn Cờ');
  });

  it('đọc document lồng và mảng', () => {
    const inner = doc([elem(0x02, 'bin', bstring('970407'))]);
    const arr = doc([elem(0x02, '0', bstring('a')), elem(0x02, '1', bstring('b'))]);
    const b = doc([elem(0x03, 'bank', inner), elem(0x04, 'ds', arr)]);
    const v = decodeDocument(b).value;
    expect(v.bank).toEqual({ bin: '970407' });
    expect(v.ds).toEqual(['a', 'b']);
  });

  it('ObjectId đọc thành chuỗi hex 24 ký tự', () => {
    const oid = Buffer.from('68a1b2c3d4e5f60718293a4b', 'hex');
    const v = decodeDocument(doc([elem(0x07, '_id', oid)])).value;
    expect(v._id).toBe('68a1b2c3d4e5f60718293a4b');
  });

  it('trả về đúng vị trí kết thúc để đọc tiếp document sau', () => {
    const d1 = doc([elem(0x10, 'id', int32(1))]);
    const d2 = doc([elem(0x10, 'id', int32(2))]);
    const both = Buffer.concat([d1, d2]);
    const r1 = decodeDocument(both, 0);
    expect(r1.value.id).toBe(1);
    expect(decodeDocument(both, r1.end).value.id).toBe(2);
  });

  it('độ dài < 5 → ném BsonParseError kèm vị trí byte', () => {
    const bad = Buffer.concat([int32(3), Buffer.from([0])]);
    expect(() => decodeDocument(bad)).toThrow(BsonParseError);
  });

  it('document bị cụt → ném lỗi, KHÔNG trả dữ liệu rác', () => {
    const full = doc([elem(0x02, 'ten', bstring('abcdef'))]);
    expect(() => decodeDocument(full.subarray(0, full.length - 3))).toThrow(/cụt/);
  });

  it('kiểu BSON lạ → ném lỗi nêu rõ tên trường', () => {
    const bad = doc([elem(0x7f, 'la_hoac', Buffer.alloc(0))]);
    expect(() => decodeDocument(bad)).toThrow(/la_hoac/);
  });
});

describe('readBsonFile — đọc theo stream', () => {
  const f = tmpFile('multi');
  const N = 500;

  beforeAll(() => {
    const parts: Buffer[] = [];
    for (let i = 1; i <= N; i++) {
      parts.push(doc([elem(0x10, 'id', int32(i)), elem(0x02, 'ten', bstring(`hồ sơ ${i}`))]));
    }
    fs.writeFileSync(f, Buffer.concat(parts));
  });
  afterAll(() => {
    try { fs.unlinkSync(f); } catch { /* đã xoá */ }
  });

  it('đọc đủ số document, đúng thứ tự', () => {
    const ids: number[] = [];
    for (const d of readBsonFile(f)) ids.push(d.id as number);
    expect(ids).toHaveLength(N);
    expect(ids[0]).toBe(1);
    expect(ids[N - 1]).toBe(N);
  });

  it('countBsonDocuments đếm đúng mà không giữ nội dung', () => {
    expect(countBsonDocuments(f)).toBe(N);
  });

  it('dừng được giữa chừng — generator không đọc hết file', () => {
    let seen = 0;
    for (const _ of readBsonFile(f)) {
      if (++seen === 3) break;
    }
    expect(seen).toBe(3);
  });

  it('file thừa byte lẻ ở cuối → ném lỗi thay vì im lặng bỏ qua', () => {
    const g = tmpFile('ragged');
    fs.writeFileSync(g, Buffer.concat([doc([elem(0x10, 'id', int32(1))]), Buffer.from([0x01, 0x02])]));
    expect(() => [...readBsonFile(g)]).toThrow(/byte lẻ|cụt/);
    fs.unlinkSync(g);
  });

  it('file rỗng → 0 document, không ném lỗi', () => {
    const g = tmpFile('empty');
    fs.writeFileSync(g, Buffer.alloc(0));
    expect([...readBsonFile(g)]).toHaveLength(0);
    fs.unlinkSync(g);
  });
});
