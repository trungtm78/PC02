'use strict';
/**
 * Ledger of "could not measure" results.
 *
 * An invariant that cannot measure on ONE step (page mid-navigation, list momentarily empty, a modal covering the rows)
 * is not "unmeasured" for the whole route if it measured fine on another step. The route is CHƯA KIỂM only when the
 * invariant never measured successfully on it in that run (lượt). Keyed by (lượt, bất biến, đường).
 */
function taoSoChuaKiem() {
  const choXet = new Map(); // key -> { luot, batBien, duong, chiTiet }
  const daDo = new Set();
  const khoa = (luot, batBien, duong) => `${luot}\u0000${batBien}\u0000${duong}`;
  return {
    khongDo(luot, batBien, duong, chiTiet) {
      const k = khoa(luot, batBien, duong);
      if (!choXet.has(k)) choXet.set(k, { luot, batBien, duong, chiTiet });
    },
    daDo(luot, batBien, duong) {
      daDo.add(khoa(luot, batBien, duong));
    },
    /** Returns the entries that never measured, then empties the ledger. */
    chot() {
      const ra = [...choXet.entries()].filter(([k]) => !daDo.has(k)).map(([, v]) => v);
      choXet.clear();
      daDo.clear();
      return ra;
    },
  };
}

/**
 * Invariants a profile asks for that never ran even once in the whole run (trigger never fired, route never reached): that is
 * CHƯA KIỂM, not a silent pass. `daKiem` maps invariant name -> times it ran.
 */
function batBienChuaChayLanNao(hoSo, daKiem) {
  const ra = [];
  const thay = new Set();
  for (const h of hoSo) {
    for (const ten of h.batBien || []) {
      if ((daKiem[ten] || 0) > 0 || thay.has(ten)) continue;
      thay.add(ten);
      ra.push({ luot: '(tổng)', batBien: ten, duong: '(cả lượt tổng)', chiTiet: `bất biến "${ten}" của hồ sơ "${h.ten}" chưa chạy lần nào trong cả lượt tổng` });
    }
  }
  return ra;
}

module.exports = { taoSoChuaKiem, batBienChuaChayLanNao };
