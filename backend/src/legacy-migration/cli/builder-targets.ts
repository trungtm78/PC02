/**
 * Đọc thẳng mã `legacy-mapper.ts` để biết builder đổ field hệ cũ vào ĐÂU.
 *
 * Nguồn sự thật duy nhất trả lời được câu "field này có ai nhận không" mà không cần chạy
 * di trú. Tách khỏi `build-field-parity.ts` để kiểm chứng được.
 *
 * Trả về DANH SÁCH đích cho mỗi field, không phải một đích. Bản cũ chỉ giữ đích ĐẦU TIÊN,
 * nên một field đổ vào hai cột — `truong_hop_bao_cao_ban_giam_doc` vào cả `baoCaoBanGiamDoc`
 * (đúng/sai) lẫn `baoCaoBanGiamDocText` (chữ) — thì cột chữ vô hình với ma trận, và ma trận
 * kết luận theo cột đúng/sai gặp trước.
 *
 * HAI nguồn, không phải một. Builder đổ dữ liệu bằng hai cơ chế:
 *
 *   1. Câu lệnh gán tường minh `col: fn(rec.field)` — đọc bằng cách quét mã.
 *   2. `parityColumns(rec, entity)` chạy theo BẢNG KHAI `PARITY[entity]` — không có chữ
 *      `rec.<field>` nào trong mã để quét.
 *
 * Bản cũ chỉ biết nguồn 1, nên MỌI field do bảng khai phụ trách đều vô hình với ma trận và
 * bị xếp nhầm thành "chưa ai đọc". Kiểu cột lấy thẳng từ bảng khai — bằng chứng chắc hơn cả
 * suy từ tên cột.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PARITY } from '../field-parity.def';
import type { Entity, Target } from './parity-classify';

/**
 * NGUỒN SỰ THẬT: parse ASSIGNMENT trong builder — `<column>: fn(rec.<field> ...)`.
 * Cho ra field cũ → cột THẬT được đổ (kể cả cột không khai trong hand-map, vd do_vat→attachmentsNote).
 * Trong block `metadata: clean({...})` (buildCase) → inMetadata=true, cột = `metadata.<key>`.
 */
export function builderTargets(): Record<Entity, Map<string, Target[]>> {
  const src = fs.readFileSync(path.join(__dirname, '..', 'legacy-mapper.ts'), 'utf8').split(/\r?\n/);
  /**
   * Điểm mù thứ ba: builder gọi HÀM PHỤ TRỢ với cùng bản ghi — `ownership(rec)` trả về
   * `assignedTeamId`/`enteredById`, `traceFields(rec)` trả về `sttCu`… Field mà hàm phụ trợ
   * đọc thì không có chữ `rec.<field>` nào trong thân builder, nên bản cũ xếp nhầm chúng
   * thành "chưa ai đọc" — `don_vi_giai_quyet` 46.476 hồ sơ bị báo là sót trong khi nó đang
   * được đổ vào `assignedTeamId` suốt.
   *
   * Đi theo lời gọi thay vì kể tên từng hàm: hàm phụ trợ mới sau này cũng tự được tính.
   */
  const daDoc = new Set<string>();
  const parseFn = (fn: string): Map<string, Target[]> => {
    const map = new Map<string, Target[]>();
    if (daDoc.has(fn)) return map;
    daDoc.add(fn);
    const start = src.findIndex((l) => l.includes(`function ${fn}(`));
    if (start < 0) return map;
    let end = src.length;
    for (let i = start + 1; i < src.length; i++) if (/^(export )?function \w+\(/.test(src[i])) { end = i; break; }
    let curColumn = ''; // LHS key gần nhất (áp cho các dòng RHS xuống hàng)
    let metaDepth = -1; // độ sâu ngoặc khi vào metadata block; -1 = ngoài
    let depth = 0;
    for (let i = start; i < end; i++) {
      const line = src[i];
      // Bắt LHS key: `  key: ...`
      const lhs = line.match(/^\s*([a-zA-Z][a-zA-Z0-9]*)\s*:/);
      if (lhs) {
        curColumn = lhs[1];
        if (curColumn === 'metadata' && line.includes('clean(')) metaDepth = depth; // vào block metadata
      }
      // Mọi rec.<field> / rec['<field>'] trên dòng → map vào curColumn hiện hành
      const fields = [
        ...[...line.matchAll(/rec\.([a-zA-Z0-9_]+)/g)].map((m) => m[1]),
        ...[...line.matchAll(/rec\['([^']+)'\]/g)].map((m) => m[1]),
      ];
      const inMeta = metaDepth >= 0 && curColumn !== 'metadata';
      for (const f of fields) {
        const dich: Target = { column: inMeta ? `metadata.${curColumn}` : curColumn, inMetadata: inMeta };
        const da = map.get(f);
        if (!da) map.set(f, [dich]);
        else if (!da.some((d) => d.column === dich.column)) da.push(dich);
      }
      // Cập nhật độ sâu ngoặc; thoát metadata khi đóng về metaDepth
      for (const ch of line) { if (ch === '{' || ch === '(') depth++; else if (ch === '}' || ch === ')') depth--; }
      if (metaDepth >= 0 && depth <= metaDepth) metaDepth = -1;
    }
    // Đi tiếp vào hàm phụ trợ được gọi với chính bản ghi ấy.
    for (let i = start; i < end; i++) {
      for (const m of src[i].matchAll(/([a-zA-Z][a-zA-Z0-9_]*)\s*\(\s*rec/g)) {
        const goi = m[1];
        if (goi === fn || daDoc.has(goi)) continue;
        if (!src.some((l) => l.includes(`function ${goi}(`))) continue;
        for (const [k, v] of parseFn(goi)) {
          const da = map.get(k);
          if (!da) map.set(k, [...v]);
          else for (const d of v) if (!da.some((x) => x.column === d.column)) da.push(d);
        }
      }
    }
    return map;
  };
  const merge = (...ms: Map<string, Target[]>[]): Map<string, Target[]> => {
    const out = new Map<string, Target[]>();
    for (const m of ms)
      for (const [k, v] of m) {
        const da = out.get(k);
        if (!da) out.set(k, [...v]);
        else for (const d of v) if (!da.some((x) => x.column === d.column)) da.push(d);
      }
    return out;
  };
  /** Đích do bảng khai `PARITY[entity]` phụ trách — `parityColumns()` đổ theo bảng này. */
  const theoBangKhai = (entity: Entity): Map<string, Target[]> => {
    const map = new Map<string, Target[]>();
    // Một field có thể có HAI dòng — `truong_hop_bao_cao_ban_giam_doc` vừa đổ vào cột
    // đúng/sai vừa đổ vào cột chữ. Ghi đè thì mất đúng cái đích quan trọng hơn.
    for (const c of PARITY[entity]) {
      const da = map.get(c.field);
      if (!da) map.set(c.field, [{ column: c.col, inMetadata: false }]);
      else if (!da.some((d) => d.column === c.col)) da.push({ column: c.col, inMetadata: false });
    }
    return map;
  };
  const trace = parseFn('traceFields');
  return {
    petition: merge(theoBangKhai('petition'), parseFn('buildPetition'), trace),
    incident: merge(theoBangKhai('incident'), parseFn('buildIncident'), trace),
    case: merge(theoBangKhai('case'), parseFn('buildCase'), parseFn('buildCaseStatistic'), trace),
  };
}
