import { ObjectId, Long } from 'mongodb';
import { toEjsonLine, parseEjsonLine, reconcileSnapshot } from './mongo-export.util';

describe('mongo-export.util', () => {
  describe('toEjsonLine / parseEjsonLine — bảo toàn kiểu BSON (canonical EJSON)', () => {
    it('round-trip ObjectId không mất kiểu', () => {
      const oid = new ObjectId('507f1f77bcf86cd799439011');
      const line = toEjsonLine({ _id: oid });
      // Canonical EJSON: ObjectId → {"$oid": "..."} — KHÔNG phải string trần
      expect(line).toContain('$oid');
      const back = parseEjsonLine(line) as { _id: ObjectId };
      expect(back._id).toBeInstanceOf(ObjectId);
      expect(back._id.toHexString()).toBe('507f1f77bcf86cd799439011');
    });

    it('round-trip Date giữ nguyên mốc thời gian', () => {
      const d = new Date('2017-03-08T00:00:00.000Z');
      const back = parseEjsonLine(toEjsonLine({ ngay: d })) as { ngay: Date };
      expect(back.ngay).toBeInstanceOf(Date);
      expect(back.ngay.getTime()).toBe(d.getTime());
    });

    it('round-trip Long (int64) không rớt về number thường', () => {
      const line = toEjsonLine({ n: Long.fromString('9007199254740993') });
      expect(line).toContain('$numberLong');
      const back = parseEjsonLine(line) as { n: Long };
      expect(back.n.toString()).toBe('9007199254740993');
    });

    it('mỗi doc là MỘT dòng (không xuống dòng giữa doc)', () => {
      const line = toEjsonLine({ a: 1, b: { c: 2 } });
      expect(line.includes('\n')).toBe(false);
    });
  });

  describe('reconcileSnapshot — phát hiện snapshot đổi giữa chừng', () => {
    it('ok khi start == end == written', () => {
      expect(reconcileSnapshot({ countStart: 100, countEnd: 100, written: 100 })).toEqual({ ok: true });
    });

    it('KHÔNG ok khi count đầu khác count cuối (dữ liệu đổi khi export)', () => {
      const r = reconcileSnapshot({ countStart: 100, countEnd: 105, written: 100 });
      expect(r.ok).toBe(false);
      expect(r.reason).toMatch(/đổi|thay|start|end/i);
    });

    it('KHÔNG ok khi số ghi ra khác count (mất doc khi stream)', () => {
      const r = reconcileSnapshot({ countStart: 100, countEnd: 100, written: 98 });
      expect(r.ok).toBe(false);
      expect(r.reason).toMatch(/ghi|written|thiếu/i);
    });
  });
});
