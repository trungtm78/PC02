'use strict';
/**
 * Bộ sinh số ngẫu nhiên CÓ HẠT GIỐNG (mulberry32).
 *
 * Bản cũ dùng `Math.random()` nên một lượt chạy không bao giờ lặp lại được: thấy lỗi mà không dựng lại được đúng chuỗi
 * thao tác đã gây ra nó. Cùng `hat` → cùng chuỗi chọn, nên "chạy lại đúng seed ấy" kiểm được bản vá.
 */
function taoPrng(hat) {
  let a = hat >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    /** Số thực trong [0,1). */
    so: rng,
    /** Số nguyên trong [0, n). */
    nguyen: (n) => Math.floor(rng() * n),
    /** Một phần tử của mảng; undefined nếu mảng rỗng. */
    chon: (ds) => (ds.length ? ds[Math.floor(rng() * ds.length)] : undefined),
    /** Chọn theo trọng số: ds = [{trongSo, ...}]. */
    chonTheoTrongSo: (ds) => {
      const tong = ds.reduce((s, x) => s + x.trongSo, 0);
      let r = rng() * tong;
      for (const x of ds) {
        r -= x.trongSo;
        if (r < 0) return x;
      }
      return ds[ds.length - 1];
    },
  };
}

/** Hạt con xác định từ hạt gốc + nhãn (mỗi đường/engine/khung nhìn một dòng số riêng nhưng vẫn lặp lại được). */
function hatCon(hat, nhan) {
  let h = (hat >>> 0) ^ 0x9e3779b9;
  for (let i = 0; i < nhan.length; i += 1) {
    h = Math.imul(h ^ nhan.charCodeAt(i), 0x85ebca6b);
    h ^= h >>> 13;
  }
  return h >>> 0;
}

module.exports = { taoPrng, hatCon };
