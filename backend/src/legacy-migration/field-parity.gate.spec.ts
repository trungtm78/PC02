import * as fs from 'fs';
import * as path from 'path';
import { PARITY, PARITY_METADATA_ONLY, type Entity } from './field-parity.def';

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
      (c) => !specByEntity[c.entity].has(c.field) && !PARITY_METADATA_ONLY.has(c.field),
    );
    if (uncovered.length) {
      const detail = uncovered.map((c) => `${c.entity}/${c.field}=${c.count}`).join(', ');
      throw new Error(
        `${uncovered.length} field CÓ DATA nhưng CHƯA có đích (sót!). Thêm vào PARITY[entity] ` +
          `hoặc PARITY_METADATA_ONLY trong field-parity.def.ts: ${detail}`,
      );
    }
    expect(uncovered.length).toBe(0);
  });

  it('spec KHÔNG khai cột thừa (mọi cột mới đều có ô data trong ma trận)', () => {
    if (!matrix) return;
    const needSet = new Set(matrix.needColumn.map((c) => `${c.entity}/${c.field}`));
    const extra: string[] = [];
    for (const e of ['petition', 'incident', 'case'] as Entity[]) {
      for (const c of PARITY[e]) if (!c.exists && !needSet.has(`${e}/${c.field}`)) extra.push(`${e}/${c.field}`);
    }
    expect(extra).toEqual([]);
  });
});
