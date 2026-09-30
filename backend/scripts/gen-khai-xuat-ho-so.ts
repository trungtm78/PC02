/** Generate full-export form columns from the same layout and bindings used by the UI. */
import * as fs from 'fs';
import * as path from 'path';
import { Prisma } from '@prisma/client';
import { docBoCuc } from './gen-khai-xuat-day-du';

const root = path.resolve(__dirname, '..', '..');
const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), 'utf8');
const layout = read('frontend/src/features/cases/legacy-form-layout.def.ts');
const incidentBinding = read(
  'frontend/src/features/incidents/legacy-form-binding.ts',
);

function mapping(
  source: string,
  start: string,
  end: string,
): Record<string, string> {
  const block = source.slice(
    source.indexOf(start),
    source.indexOf(end, source.indexOf(start)),
  );
  return Object.fromEntries(
    [
      ...block.matchAll(
        /(?:^|\s)([A-Za-z][A-Za-z0-9_]*)\s*:\s*['"]([A-Za-z][A-Za-z0-9_]*)['"]/gm,
      ),
    ].map((match) => [match[1], match[2]]),
  );
}

const caseMap = mapping(layout, 'export const LEGACY_FIELD_TO_COLUMN', '};');
const incidentMap = mapping(incidentBinding, 'const CO_COT_RIENG', '};');
const fields = docBoCuc(layout);

type FormColumn = {
  key: string;
  caption: string;
  source: 'scalar' | 'metadata' | 'statistic';
  path: string;
};

function registry(modelName: 'Case' | 'Incident'): FormColumn[] {
  const scalar = new Set(
    Prisma.dmmf.datamodel.models
      .find((model) => model.name === modelName)!
      .fields.filter((field) => field.kind !== 'object')
      .map((field) => field.name),
  );
  const identity =
    modelName === 'Case'
      ? [
          ['id', 'Mã định danh'],
          ['caseCode', 'Mã hồ sơ'],
          ['name', 'Tên vụ án'],
          ['caseType', 'Loại hồ sơ'],
          ['status', 'Trạng thái'],
        ]
      : [
          ['id', 'Mã định danh'],
          ['code', 'Mã hồ sơ'],
          ['name', 'Tên vụ việc'],
          ['status', 'Trạng thái'],
        ];
  const output: FormColumn[] = identity.map(([key, caption]) => ({
    key,
    caption,
    source: 'scalar',
    path: key,
  }));
  const seen = new Set(output.map((item) => `${item.source}.${item.path}`));
  const add = (
    key: string,
    caption: string,
    source: FormColumn['source'],
    valuePath: string,
  ) => {
    const signature = `${source}.${valuePath}`;
    if (!seen.has(signature)) {
      seen.add(signature);
      output.push({ key, caption, source, path: valuePath });
    }
  };
  for (const { field, caption } of fields) {
    if (modelName === 'Case') {
      if (field.startsWith('statistic.')) {
        add(field, caption, 'statistic', field.slice('statistic.'.length));
      } else {
        const stored = caseMap[field] ?? field;
        add(field, caption, scalar.has(stored) ? 'scalar' : 'metadata', stored);
      }
    } else {
      const stored = incidentMap[field] ?? field.replace('statistic.', '');
      add(field, caption, scalar.has(stored) ? 'scalar' : 'metadata', stored);
    }
  }
  if (modelName === 'Case') {
    for (const [field, caption, stored] of [
      ['utdt_loaiUyThac', 'Loại ủy thác', 'loaiUyThac'],
      ['utdt_donViGiao', 'Đơn vị giao', 'donViGiao'],
      ['utdt_soQuyetDinhUyThac', 'Số quyết định ủy thác', 'soQuyetDinhUyThac'],
      ['utdt_ngayTraKetQua', 'Ngày trả kết quả', 'ngayTraKetQua'],
      ['utdt_ketQuaUyThac', 'Kết quả xử lý', 'ketQuaUyThac'],
      [
        'utdt_ngayThongBaoKhongThucHien',
        'Ngày thông báo không thực hiện được',
        'ngayThongBaoKhongThucHien',
      ],
      [
        'utdt_lyDoKhongThucHienDuoc',
        'Lý do không thực hiện được',
        'lyDoKhongThucHienDuoc',
      ],
    ])
      add(field, caption, scalar.has(stored) ? 'scalar' : 'metadata', stored);
    for (const [stored, caption] of [
      ['caseClassification', 'Phân loại vụ án'],
      ['caseProvenance', 'Nguồn vụ án'],
      ['linkedIncidentId', 'Mã vụ việc gốc'],
      ['linkedPetitionId', 'Mã đơn thư gốc'],
      ['ngayVietDonChu', 'Ngày viết đơn (nguyên văn)'],
      ['ngayVietDonEdtf', 'Ngày viết đơn (thiếu thành phần)'],
      ['phanLoaiToiPhamLinhVuc', 'Phân loại tội phạm theo lĩnh vực'],
      ['receiveDate', 'Ngày tiếp nhận vụ án'],
      ['reporterDateOfBirth', 'Ngày sinh người báo tin'],
      ['soHoSoCu', 'Số hồ sơ cũ'],
      ['sourceDocumentNote', 'Ghi chú tài liệu nguồn'],
      ['sttCu', 'STT cũ'],
      ['tinhTrang', 'Tình trạng hồ sơ'],
      ['unit', 'Đơn vị tiếp nhận'],
      ['yeuCauBoSung', 'Yêu cầu bổ sung'],
    ])
      add(stored, caption, 'scalar', stored);
  } else {
    for (const [stored, caption] of [
      ['canBoNhapId', 'Mã cán bộ nhập'],
      ['canCuKhoiToCode', 'Căn cứ khởi tố'],
      ['deadline', 'Hạn giải quyết'],
      ['doiTuongToChuc', 'Tổ chức liên quan'],
      ['incidentType', 'Loại vụ việc'],
      ['investigatorId', 'Mã điều tra viên'],
      ['loaiDonVu', 'Loại nguồn tin'],
      ['loaiKetQua', 'Loại kết quả'],
      ['ngayQuyetDinh', 'Ngày ra quyết định'],
      ['ngayVietDonChu', 'Ngày viết đơn (nguyên văn)'],
      ['ngayVietDonEdtf', 'Ngày viết đơn (thiếu thành phần)'],
      ['nguoiQuyetDinh', 'Người ra quyết định'],
      ['nguonPhatTin', 'Nguồn phát tin'],
      ['phuongThucTiepNhan', 'Phương thức tiếp nhận'],
      ['soQuyetDinh', 'Số quyết định'],
      ['tinhTrangHoSo', 'Tình trạng hồ sơ'],
      ['tinhTrangThoiHieu', 'Tình trạng thời hiệu'],
    ])
      add(stored, caption, 'scalar', stored);
  }
  return output;
}

const target = path.join(
  root,
  'backend/src/common/xuat-danh-sach/khai-truong-ho-so.generated.ts',
);
async function generate(): Promise<void> {
  const prettier = await import('prettier');
  const source =
    `/* Generated by backend/scripts/gen-khai-xuat-ho-so.ts. */\n` +
    `export const TRUONG_FORM_VU_AN = ${JSON.stringify(registry('Case'), null, 2)} as const;\n` +
    `export const TRUONG_FORM_VU_VIEC = ${JSON.stringify(registry('Incident'), null, 2)} as const;\n`;
  const config = (await prettier.resolveConfig(target)) ?? {};
  fs.writeFileSync(
    target,
    await prettier.format(source, { ...config, filepath: target }),
    'utf8',
  );
  console.log(`Generated ${target}`);
}

if (require.main === module) {
  void generate().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
