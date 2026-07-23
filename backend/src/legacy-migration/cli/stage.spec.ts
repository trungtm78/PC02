import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { collectionOf, rowHashOf, sourceIdOf, chunk, fileChecksum, LEGACY_KEY_VERSION } from './stage';

describe('collectionOf — tiền tố khoá chống trùng', () => {
  it('bỏ đuôi .bson và bỏ đường dẫn', () => {
    expect(collectionOf('ho_so_doi_1.bson')).toBe('ho_so_doi_1');
    expect(collectionOf('C:/PC02/docs/requirements/DB/ho_so.bson')).toBe('ho_so');
  });

  it('hai collection khác nhau cho tiền tố khác nhau (ho_so.id 1..4 trùng ho_so_doi_1)', () => {
    expect(collectionOf('ho_so.bson')).not.toBe(collectionOf('ho_so_doi_1.bson'));
  });

  it('đuôi viết hoa vẫn nhận', () => {
    expect(collectionOf('ToiDanh.BSON')).toBe('ToiDanh');
  });
});

describe('sourceIdOf', () => {
  it('ưu tiên cột id của hệ cũ hơn _id kỹ thuật', () => {
    expect(sourceIdOf({ id: 53820, _id: 'abc123' })).toBe('53820');
  });

  it('không có id thì lùi về _id — KHÔNG bỏ mất bản ghi', () => {
    expect(sourceIdOf({ _id: '68a1b2c3d4e5f60718293a4b' })).toBe('68a1b2c3d4e5f60718293a4b');
  });

  it('không có gì → undefined để caller đếm là bỏ qua', () => {
    expect(sourceIdOf({ ten: 'x' })).toBeUndefined();
    expect(sourceIdOf({ id: '   ' })).toBeUndefined();
    expect(sourceIdOf({ id: null })).toBeUndefined();
  });

  it('id = 0 vẫn là id hợp lệ, không được coi là trống', () => {
    expect(sourceIdOf({ id: 0 })).toBe('0');
  });
});

describe('rowHashOf', () => {
  it('cùng nội dung → cùng mã băm', () => {
    expect(rowHashOf({ id: 1, ten: 'a' })).toBe(rowHashOf({ id: 1, ten: 'a' }));
  });

  it('khác một ký tự → khác mã băm', () => {
    expect(rowHashOf({ id: 1, ten: 'a' })).not.toBe(rowHashOf({ id: 1, ten: 'b' }));
  });

  it('trả về sha256 dạng hex 64 ký tự', () => {
    expect(rowHashOf({ id: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('chunk — chia lô', () => {
  it('chia đều và giữ nguyên thứ tự', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('mảng rỗng → không có lô nào', () => {
    expect(chunk([], 500)).toEqual([]);
  });

  it('kích thước lô <= 0 → ném lỗi thay vì lặp vô tận', () => {
    expect(() => chunk([1], 0)).toThrow();
  });
});

describe('fileChecksum — chốt nguồn chân lý', () => {
  const f = path.join(os.tmpdir(), `pc02-chk-${process.pid}.bin`);
  afterAll(() => {
    try { fs.unlinkSync(f); } catch { /* đã xoá */ }
  });

  it('cùng nội dung → cùng checksum; đổi 1 byte → khác', () => {
    fs.writeFileSync(f, Buffer.from('abc'));
    const a = fileChecksum(f);
    expect(fileChecksum(f)).toBe(a);
    fs.writeFileSync(f, Buffer.from('abd'));
    expect(fileChecksum(f)).not.toBe(a);
  });

  it('đọc được file lớn hơn buffer 1MB (không cắt ngang)', () => {
    fs.writeFileSync(f, Buffer.alloc(3 * 1024 * 1024, 7));
    expect(fileChecksum(f)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('LEGACY_KEY_VERSION', () => {
  it('là hằng số có tên rõ ràng — đổi giá trị này buộc phải nạp lại từ đầu', () => {
    expect(LEGACY_KEY_VERSION).toBe('v2-collection-prefixed');
  });
});
