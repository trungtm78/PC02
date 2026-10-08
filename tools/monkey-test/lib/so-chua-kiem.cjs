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

module.exports = { taoSoChuaKiem };
