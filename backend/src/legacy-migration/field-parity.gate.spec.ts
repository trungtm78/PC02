import * as fs from 'fs';
import * as path from 'path';
import {
  PARITY,
  PARITY_HOAN_THEO_THUC_THE,
  PARITY_METADATA_ONLY,
  type Entity,
} from './field-parity.def';
import { O_HE_CU_TREN_FORM } from '../cases/legacy-form-parity.mapper';

/**
 * GATE "KHÔNG SÓT DỮ LIỆU" (pháp lý). Đọc ma trận field-parity (sinh từ data thật,
 * `build-field-parity.ts`) + spec `field-parity.def.ts`: MỌI ô field-có-data cần cột
 * (NEEDS_COLUMN / METADATA_ONLY) PHẢI được spec phủ — hoặc thành CỘT (PARITY[entity]),
 * hoặc CỐ Ý giữ metadata (PARITY_METADATA_ONLY). Field mới xuất hiện tương lai không có
 * đích → test ĐỎ → buộc quyết định, không âm thầm sót.
 *
 * Cập nhật ma trận: set -a && source .env && set +a; ts-node cli/build-field-parity.ts
 */
interface Cell { entity: Entity; count: number; status: string }
interface MatrixRow { field: string; cells: Cell[] }
interface Matrix { rows: MatrixRow[]; needColumn: Array<{ field: string; entity: Entity; count: number; status: string }> }

const MATRIX_PATH = path.resolve(__dirname, '../../../docs/legacy/field-parity-matrix.json');

describe('GATE field-parity — không sót dữ liệu', () => {
  const exists = fs.existsSync(MATRIX_PATH);
  const matrix: Matrix | null = exists ? JSON.parse(fs.readFileSync(MATRIX_PATH, 'utf8')) : null;

  it('ma trận field-parity tồn tại (build-field-parity.ts đã chạy)', () => {
    expect(exists).toBe(true);
  });

  it('MỌI field-có-data cần cột đều có đích trong spec (cột HOẶC metadata cố ý)', () => {
    if (!matrix) return;
    const specByEntity: Record<Entity, Set<string>> = {
      petition: new Set(PARITY.petition.map((c) => c.field)),
      incident: new Set(PARITY.incident.map((c) => c.field)),
      case: new Set(PARITY.case.map((c) => c.field)),
    };
    const uncovered = matrix.needColumn.filter(
      (c) =>
        !specByEntity[c.entity].has(c.field) &&
        !PARITY_METADATA_ONLY.has(c.field) &&
        !PARITY_HOAN_THEO_THUC_THE.has(`${c.entity}/${c.field}`),
    );
    if (uncovered.length) {
      const detail = uncovered.map((c) => `${c.entity}/${c.field}=${c.count}`).join(', ');
      throw new Error(
        `${uncovered.length} field CÓ DATA nhưng CHƯA có đích (sót!). Thêm vào PARITY[entity], ` +
          `PARITY_METADATA_ONLY hoặc PARITY_HOAN_THEO_THUC_THE trong field-parity.def.ts: ${detail}`,
      );
    }
    expect(uncovered.length).toBe(0);
  });

  /**
   * Cột khai trong spec phải có lý do: hoặc dữ liệu cũ cần chỗ ở, hoặc form cần chỗ lưu.
   *
   * Bản trước hỏi sai câu: nó đòi mỗi cột của spec phải nằm trong danh sách "CẦN THÊM CỘT"
   * của ma trận. Danh sách ấy là danh sách VIỆC CHƯA LÀM — nên một cột đã dựng xong và đang
   * đổ dữ liệu đầy đủ thì biến mất khỏi đó, và cổng kiểm kết luận nó thừa. Ca kiểm ấy chỉ
   * xanh được chừng nào bộ sinh ma trận còn mù với bảng khai `PARITY`; vá bộ sinh xong là nó
   * đỏ với 73 cột hoàn toàn chính đáng.
   *
   * Câu hỏi thật là "field này có dữ liệu ở thực thể ấy không", và ma trận trả lời được bằng
   * SỐ ĐẾM, độc lập với trạng thái. `formOnly` vẫn là lý do thứ hai, khai tường minh: hệ cũ
   * VẪN đang nhận nhập liệu, nên ô cán bộ gõ được phải có cột kể cả khi dữ liệu hôm nay chưa
   * có bản ghi nào.
   */
  it('spec KHÔNG khai cột thừa (cột mới phải có dữ liệu, hoặc khai rõ là để form nhập được)', () => {
    if (!matrix) return;
    const coData = new Set<string>();
    for (const r of matrix.rows)
      for (const c of r.cells) if (c.count > 0) coData.add(`${c.entity}/${r.field}`);
    const extra: string[] = [];
    for (const e of ['petition', 'incident', 'case'] as Entity[]) {
      for (const c of PARITY[e]) {
        // `exists: true` = cột KHÔNG mới, đã có sẵn cho tính năng hệ mới; dòng spec chỉ dạy
        // bộ di trú đọc nốt khoá cũ tương ứng. Luật "cột mới phải có dữ liệu" không áp cho nó.
        if (c.exists || c.formOnly) continue;
        if (!coData.has(`${e}/${c.field}`)) extra.push(`${e}/${c.field}`);
      }
    }
    expect(extra).toEqual([]);
  });

  /**
   * Cờ `formOnly` phải kèm ô thật trên form, không được dùng làm cửa sau để khai cột bừa.
   */
  it('mọi cột formOnly đều ứng với một ô có thật trên form Vụ án', () => {
    // Nguồn đối chiếu là danh sách ô mà tầng lưu của form Vụ án phụ trách. Ô nào không nằm
    // trong đó thì `formOnly` là lời khai suông.
    const coTrenForm = new Set(O_HE_CU_TREN_FORM);
    const khongCoO = PARITY.case
      .filter((c) => c.formOnly)
      .map((c) => c.col)
      .filter((col) => !coTrenForm.has(col));
    expect(khongCoO).toEqual([]);
  });
});
