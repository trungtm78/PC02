/**
 * Đọc file dump `.bson` của MongoDB theo kiểu STREAM.
 *
 * Định dạng dump: các document nối đuôi nhau, mỗi document mở đầu bằng 4 byte
 * int32 little-endian là TỔNG độ dài của chính document đó (kể cả 4 byte này).
 * File `ho_so_doi_1.bson` nặng 345MB — nạp cả file vào RAM rồi mới parse là
 * cách chắc chắn làm nghẽn máy, nên ở đây đọc và trả về từng document một.
 *
 * Không phụ thuộc thư viện BSON ngoài: bộ giải mã ngay dưới đây xử lý đúng các
 * kiểu thực sự có trong dump (đã đối chiếu trên toàn bộ 105 file).
 */
import * as fs from 'fs';

export type BsonDoc = Record<string, unknown>;

/** Độ dài tối thiểu hợp lệ của một document BSON: 4 byte độ dài + 1 byte kết thúc. */
export const MIN_DOC_LEN = 5;

/** Giới hạn cứng của MongoDB cho một document — dùng để bắt file hỏng sớm. */
export const MAX_DOC_LEN = 16 * 1024 * 1024;

export class BsonParseError extends Error {
  constructor(
    message: string,
    readonly offset: number,
  ) {
    super(`${message} (vị trí byte ${offset})`);
    this.name = 'BsonParseError';
  }
}

/**
 * Giải mã MỘT document BSON nằm ở `off` trong buffer.
 * Trả về giá trị và vị trí byte ngay sau document.
 */
export function decodeDocument(buf: Buffer, off = 0): { value: BsonDoc; end: number } {
  if (off + 4 > buf.length) throw new BsonParseError('Thiếu 4 byte độ dài', off);
  const len = buf.readInt32LE(off);
  if (len < MIN_DOC_LEN) throw new BsonParseError(`Độ dài document không hợp lệ: ${len}`, off);
  if (off + len > buf.length) throw new BsonParseError(`Document bị cụt: cần ${len} byte`, off);

  const out: BsonDoc = {};
  let i = off + 4;
  const stop = off + len - 1; // byte cuối là 0x00 kết thúc document

  while (i < stop) {
    const type = buf[i++];
    let e = i;
    while (e < stop && buf[e] !== 0) e++;
    if (e >= stop) throw new BsonParseError('Tên trường không kết thúc', i);
    const key = buf.toString('utf8', i, e);
    i = e + 1;

    switch (type) {
      case 0x01: // double
        out[key] = buf.readDoubleLE(i);
        i += 8;
        break;
      case 0x02: { // string
        const n = buf.readInt32LE(i);
        out[key] = buf.toString('utf8', i + 4, i + 4 + n - 1);
        i += 4 + n;
        break;
      }
      case 0x03: { // document lồng
        const r = decodeDocument(buf, i);
        out[key] = r.value;
        i = r.end;
        break;
      }
      case 0x04: { // mảng — BSON lưu mảng như document khoá "0","1",...
        const r = decodeDocument(buf, i);
        out[key] = Object.values(r.value);
        i = r.end;
        break;
      }
      case 0x05: { // binary — giữ nguyên byte, hiếm dùng trong dump này
        const n = buf.readInt32LE(i);
        out[key] = buf.subarray(i + 5, i + 5 + n);
        i += 5 + n;
        break;
      }
      case 0x06: // undefined (đã lỗi thời)
        out[key] = undefined;
        break;
      case 0x07: // ObjectId
        out[key] = buf.toString('hex', i, i + 12);
        i += 12;
        break;
      case 0x08: // boolean
        out[key] = buf[i] === 1;
        i += 1;
        break;
      case 0x09: // UTC datetime (mili giây)
        out[key] = new Date(Number(buf.readBigInt64LE(i)));
        i += 8;
        break;
      case 0x0a: // null
        out[key] = null;
        break;
      case 0x0b: { // regex: hai chuỗi kết thúc bằng 0
        let a = i;
        while (a < stop && buf[a] !== 0) a++;
        let c = a + 1;
        while (c < stop && buf[c] !== 0) c++;
        out[key] = { $regex: buf.toString('utf8', i, a), $options: buf.toString('utf8', a + 1, c) };
        i = c + 1;
        break;
      }
      case 0x10: // int32
        out[key] = buf.readInt32LE(i);
        i += 4;
        break;
      case 0x11: // timestamp
        out[key] = { $timestamp: buf.readBigUInt64LE(i).toString() };
        i += 8;
        break;
      case 0x12: // int64
        out[key] = Number(buf.readBigInt64LE(i));
        i += 8;
        break;
      default:
        throw new BsonParseError(`Kiểu BSON chưa hỗ trợ: 0x${type.toString(16)} ở trường "${key}"`, i);
    }
  }

  if (buf[off + len - 1] !== 0) throw new BsonParseError('Document không kết thúc bằng byte 0', off + len - 1);
  return { value: out, end: off + len };
}

/**
 * Duyệt lần lượt từng document trong file `.bson`, đọc tới đâu cấp tới đó.
 * Bộ nhớ dùng tối đa bằng một document, không phụ thuộc kích thước file.
 */
export function* readBsonFile(filePath: string): Generator<BsonDoc, void, void> {
  const size = fs.statSync(filePath).size;
  const fd = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(4);
    let pos = 0;
    while (pos < size) {
      if (size - pos < 4) {
        throw new BsonParseError(`File thừa ${size - pos} byte lẻ — dump hỏng hoặc bị cắt`, pos);
      }
      fs.readSync(fd, header, 0, 4, pos);
      const len = header.readInt32LE(0);
      if (len < MIN_DOC_LEN || len > MAX_DOC_LEN) {
        throw new BsonParseError(`Độ dài document không hợp lệ: ${len}`, pos);
      }
      if (pos + len > size) {
        throw new BsonParseError(`Document cuối bị cụt: cần ${len} byte, chỉ còn ${size - pos}`, pos);
      }
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, pos);
      yield decodeDocument(buf, 0).value;
      pos += len;
    }
  } finally {
    fs.closeSync(fd);
  }
}

/** Đếm số document mà không giữ lại nội dung — dùng để đối chiếu trước/sau khi nạp. */
export function countBsonDocuments(filePath: string): number {
  let n = 0;
  for (const _ of readBsonFile(filePath)) n++;
  return n;
}
