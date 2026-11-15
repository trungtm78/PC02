import { khoaLoaiThongTin } from '../../common/utils/khoa-loai-thong-tin.util';
import { buildTypeIndex, resolveFlow, type ResolveBinding, type ResolveFlowRow } from './resolve-flow';

const catalogue = [
  { id: 'd-tocao', name: 'Tố cáo', metadata: null },
  { id: 'd-khieunai', name: 'Khiếu nại', metadata: null },
  { id: 'd-togiac', name: 'Tố giác về tội phạm', metadata: null },
  // The catalogue decides the group, not the name: an administrator moved this one.
  { id: 'd-dexuat', name: 'Đề xuất', metadata: { nhomHan: 'KIEN_NGHI' } },
];
const directoryIndex = buildTypeIndex(catalogue);

const flow = (id: string, recordKind: ResolveFlowRow['recordKind'], over: Partial<ResolveFlowRow> = {}): ResolveFlowRow => ({
  id,
  recordKind,
  isDefault: false,
  status: 'ACTIVE',
  ...over,
});
const typeBinding = (flowId: string, recordKind: ResolveBinding['recordKind'], directoryId: string, name: string): ResolveBinding => ({
  flowId,
  recordKind,
  directoryId,
  typeKey: khoaLoaiThongTin(name),
  deadlineGroup: null,
});
const groupBinding = (flowId: string, deadlineGroup: string): ResolveBinding => ({
  flowId,
  recordKind: 'PETITION',
  directoryId: null,
  typeKey: null,
  deadlineGroup,
});

const flows = [
  flow('f-default-petition', 'PETITION', { isDefault: true }),
  flow('f-tocao', 'PETITION'),
  flow('f-complaints', 'PETITION'),
  flow('f-incident-togiac', 'INCIDENT'),
  flow('f-archived', 'PETITION', { status: 'ARCHIVED' }),
];
const bindings = [
  typeBinding('f-tocao', 'PETITION', 'd-tocao', 'Tố cáo'),
  groupBinding('f-complaints', 'KHIEU_NAI'),
  typeBinding('f-incident-togiac', 'INCIDENT', 'd-togiac', 'Tố giác về tội phạm'),
];
const config = { directoryIndex, bindings, flows };

describe('buildTypeIndex', () => {
  it('indexes the catalogue by the merged key, with the deadline group of each entry', () => {
    expect(directoryIndex.get('to cao')).toEqual({ id: 'd-tocao', name: 'Tố cáo', deadlineGroup: 'TO_CAO' });
    expect(directoryIndex.get('de xuat')?.deadlineGroup).toBe('KIEN_NGHI');
    expect(directoryIndex.get('to giac ve toi pham')?.deadlineGroup).toBe('PHAN_ANH');
  });

  it('two entries with the same key: the first one wins (the query sorts by code)', () => {
    const index = buildTypeIndex([
      { id: 'a', name: 'Tố cáo', metadata: null },
      { id: 'b', name: 'TỐ CÁO.', metadata: null },
    ]);
    expect(index.get('to cao')?.id).toBe('a');
    expect(index.size).toBe(1);
  });
});

describe('resolveFlow', () => {
  it('TYPE: a known type bound to a flow, however the text is written', () => {
    for (const text of ['Tố cáo', 'tố cáo', 'TỐ CÁO.', 'Tố cáo (02 đơn)']) {
      expect(resolveFlow({ recordKind: 'PETITION', informationType: text }, config)).toEqual({
        match: 'TYPE',
        flowId: 'f-tocao',
        directoryId: 'd-tocao',
        typeKey: 'to cao',
      });
    }
  });

  it('GROUP: a known type of a petition that is not bound itself goes by its deadline group', () => {
    expect(resolveFlow({ recordKind: 'PETITION', informationType: 'Khiếu nại' }, config)).toEqual({
      match: 'GROUP',
      flowId: 'f-complaints',
      directoryId: 'd-khieunai',
      typeKey: 'khieu nai',
    });
  });

  it('a binding of the type itself wins over a binding of its group', () => {
    const both = { ...config, bindings: [...bindings, groupBinding('f-complaints', 'TO_CAO')] };
    expect(resolveFlow({ recordKind: 'PETITION', informationType: 'Tố cáo' }, both)?.match).toBe('TYPE');
  });

  it('DEFAULT: a known type nothing is bound to falls to the default flow of its kind', () => {
    expect(resolveFlow({ recordKind: 'PETITION', informationType: 'Đề xuất' }, config)).toEqual({
      match: 'DEFAULT',
      flowId: 'f-default-petition',
      directoryId: 'd-dexuat',
      typeKey: 'de xuat',
    });
  });

  it('DEFAULT: no information type at all', () => {
    for (const empty of [null, undefined, '', '   ']) {
      expect(resolveFlow({ recordKind: 'PETITION', informationType: empty }, config)).toEqual({ match: 'DEFAULT', flowId: 'f-default-petition' });
    }
  });

  it('UNKNOWN_TYPE: text that is there but means nothing once merged (punctuation only) is not "no information type"', () => {
    for (const text of [';', ' , ', '.', ';;', '...']) {
      expect(khoaLoaiThongTin(text)).toBeFalsy();
      expect(resolveFlow({ recordKind: 'PETITION', informationType: text }, config)).toEqual({ match: 'UNKNOWN_TYPE', flowId: 'f-default-petition' });
    }
    expect(resolveFlow({ recordKind: 'INCIDENT', informationType: ';' }, config)).toBeNull();
  });

  it('a binding of the very entry wins over a binding that only holds the same key', () => {
    // Two entries whose names merge to one key, bound to two flows: the row the text resolves to decides, never the order.
    const twin = { id: 'd-tocao-twin', name: 'Tố  Cáo', metadata: null };
    const index = buildTypeIndex([...catalogue, twin]);
    const both = [typeBinding('f-other', 'PETITION', 'd-tocao-twin', 'Tố cáo'), typeBinding('f-tocao', 'PETITION', 'd-tocao', 'Tố cáo')];
    const result = resolveFlow({ recordKind: 'PETITION', informationType: 'Tố cáo' }, { directoryIndex: index, bindings: both, flows: [...flows, flow('f-other', 'PETITION')] });
    expect(result).toMatchObject({ match: 'TYPE', flowId: 'f-tocao', directoryId: 'd-tocao' });
  });

  it('an unbound entry that merges to the same key must not hide a bound one that was renamed to it', () => {
    // X was bound as "Alpha" and renamed "Beta" (its stored key stays "alpha"); Y, unbound and EARLIER in the
    // catalogue, was renamed "Beta" too. The text "Beta" reaches X's flow, not the default one.
    const x = { id: 'd-x', name: 'Beta', metadata: null };
    const y = { id: 'd-y', name: 'Beta', metadata: null };
    const index = buildTypeIndex([y, x]);
    const renamedBinding: ResolveBinding = { flowId: 'f-tocao', recordKind: 'PETITION', directoryId: 'd-x', typeKey: khoaLoaiThongTin('Alpha'), deadlineGroup: null };
    const result = resolveFlow(
      { recordKind: 'PETITION', informationType: 'Beta' },
      { directoryIndex: index, bindings: [renamedBinding], flows, directoryNames: [y, x] },
    );
    expect(result).toMatchObject({ match: 'TYPE', flowId: 'f-tocao', directoryId: 'd-x' });
  });

  it('UNKNOWN_TYPE: raw legacy text and composite values match no entry; the default flow is only a proposal', () => {
    for (const text of ['Tố giác, Đề nghị', 'Đơn trình báo mất xe', 'Tố cáo/khiếu nại']) {
      expect(resolveFlow({ recordKind: 'PETITION', informationType: text }, config)).toEqual({
        match: 'UNKNOWN_TYPE',
        flowId: 'f-default-petition',
        typeKey: khoaLoaiThongTin(text),
      });
    }
  });

  it('a type bound for another record kind does not count: groups exist for petitions only', () => {
    // "Tố cáo" is bound for petitions; an incident of that type has neither a binding nor a default flow.
    expect(resolveFlow({ recordKind: 'INCIDENT', informationType: 'Tố cáo' }, config)).toBeNull();
    // "Tố giác về tội phạm" is bound for incidents; a petition of that type falls to the petition default.
    expect(resolveFlow({ recordKind: 'PETITION', informationType: 'Tố giác về tội phạm' }, config)?.match).toBe('DEFAULT');
    expect(resolveFlow({ recordKind: 'INCIDENT', informationType: 'Tố giác về tội phạm' }, config)).toEqual({
      match: 'TYPE',
      flowId: 'f-incident-togiac',
      directoryId: 'd-togiac',
      typeKey: 'to giac ve toi pham',
    });
    // A group binding is never read for a case or an incident.
    const strayGroup = { ...config, bindings: [{ ...groupBinding('f-incident-togiac', 'TO_CAO'), recordKind: 'INCIDENT' as const }] };
    expect(resolveFlow({ recordKind: 'INCIDENT', informationType: 'Tố cáo' }, strayGroup)).toBeNull();
  });

  it('nothing bound and no default flow: no flow', () => {
    expect(resolveFlow({ recordKind: 'CASE', informationType: 'Tố cáo' }, config)).toBeNull();
    expect(resolveFlow({ recordKind: 'CASE', informationType: null }, config)).toBeNull();
    expect(resolveFlow({ recordKind: 'CASE', informationType: 'chữ lạ' }, config)).toBeNull();
  });

  it('an archived flow is not there: neither its bindings nor its default mark', () => {
    const archived = {
      directoryIndex,
      flows: [flow('f-archived', 'PETITION', { status: 'ARCHIVED', isDefault: true })],
      bindings: [typeBinding('f-archived', 'PETITION', 'd-tocao', 'Tố cáo'), groupBinding('f-archived', 'TO_CAO')],
    };
    expect(resolveFlow({ recordKind: 'PETITION', informationType: 'Tố cáo' }, archived)).toBeNull();
  });

  it('a type renamed after it was bound: both the new name (by its row) and the old text (by the kept key) reach the flow', () => {
    const renamed = buildTypeIndex([{ id: 'd-tocao', name: 'Đơn tố cáo công dân', metadata: null }]);
    const after = { ...config, directoryIndex: renamed };
    expect(resolveFlow({ recordKind: 'PETITION', informationType: 'Đơn tố cáo công dân' }, after)).toEqual({
      match: 'TYPE',
      flowId: 'f-tocao',
      directoryId: 'd-tocao',
      typeKey: 'don to cao cong dan',
    });
    expect(resolveFlow({ recordKind: 'PETITION', informationType: 'Tố cáo' }, after)).toEqual({
      match: 'TYPE',
      flowId: 'f-tocao',
      directoryId: 'd-tocao',
      typeKey: 'to cao',
    });
  });
});
