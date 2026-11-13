import { permissions as L } from '@/locales/permissions.vi';
import { permissionLabel, reachLabel, type CatalogueIndex } from '../labels';
import { dateInputValue, emptyOverride, emptyTeamOverride, expiryFromDateInput, normaliseOverride, reachChoices } from '../overrides';
import { AUDIENCES, EFFECT, type Audience, type Effect, type Override, type Reach, type TeamOverride } from '../types';
import { BTN_SMALL, INPUT } from './ui';

type Row = Override & { audience?: Audience };

interface Props<T extends Row> {
  rows: readonly T[];
  onChange: (rows: T[]) => void;
  index: CatalogueIndex;
  /** A team's overrides say who they are for; a person's own do not. */
  withAudience: boolean;
  readOnly: boolean;
  testId: string;
}

const S = L.overrides;
const EFFECTS: readonly Effect[] = [EFFECT.GRANT, EFFECT.MUTE];

/** Exceptions on top of the templates: grant or switch off one permission, with a reason and an optional end date. */
export function OverridesTable<T extends Row>({ rows, onChange, index, withAudience, readOnly, testId }: Props<T>) {
  const update = (at: number, patch: Partial<Row>) =>
    onChange(rows.map((row, i) => (i === at ? normaliseOverride(index, { ...row, ...patch } as T) : row)));
  const add = () => onChange([...rows, (withAudience ? emptyTeamOverride() : emptyOverride()) as unknown as T]);
  const remove = (at: number) => onChange(rows.filter((_, i) => i !== at));
  const options = [...index.keys()];

  return (
    <div data-testid={testId}>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500" data-testid={`${testId}-empty`}>
          {S.empty}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="py-1 pr-2">{S.permission}</th>
                <th className="py-1 pr-2">{S.effect}</th>
                <th className="py-1 pr-2">{S.reach}</th>
                {withAudience && <th className="py-1 pr-2">{S.audience}</th>}
                <th className="py-1 pr-2">{S.reason}</th>
                <th className="py-1 pr-2">{S.expiresAt}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const choices = reachChoices(index, row.permission);
                const scoped = choices.length > 1;
                const id = `${testId}-${i}`;
                return (
                  <tr key={i} data-testid={`${id}-row`} className="border-t border-slate-100 align-top">
                    <td className="py-1 pr-2">
                      <select
                        aria-label={`${S.rowOf(i + 1)}: ${S.permission}`}
                        data-testid={`${id}-permission`}
                        className={`${INPUT} max-w-[16rem]`}
                        value={row.permission}
                        disabled={readOnly}
                        onChange={(e) => update(i, { permission: e.target.value })}
                      >
                        <option value="">{S.pickPermission}</option>
                        {row.permission && !index.has(row.permission) && <option value={row.permission}>{row.permission}</option>}
                        {options.map((key) => (
                          <option key={key} value={key}>
                            {permissionLabel(index, key)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1 pr-2">
                      <select
                        aria-label={`${S.rowOf(i + 1)}: ${S.effect}`}
                        data-testid={`${id}-effect`}
                        className={INPUT}
                        value={row.effect}
                        disabled={readOnly}
                        onChange={(e) => update(i, { effect: e.target.value as Effect })}
                      >
                        {EFFECTS.map((effect) => (
                          <option key={effect} value={effect}>
                            {S.effects[effect]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1 pr-2">
                      {row.effect === EFFECT.GRANT ? (
                        <select
                          aria-label={`${S.rowOf(i + 1)}: ${S.reach}`}
                          data-testid={`${id}-reach`}
                          className={INPUT}
                          value={row.reach ?? ''}
                          disabled={readOnly || !row.permission}
                          onChange={(e) => update(i, { reach: (e.target.value || null) as Reach | null })}
                        >
                          {scoped && <option value="">—</option>}
                          {choices.map((reach) => (
                            <option key={reach} value={reach}>
                              {reachLabel(reach, scoped)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    {withAudience && (
                      <td className="py-1 pr-2">
                        <select
                          aria-label={`${S.rowOf(i + 1)}: ${S.audience}`}
                          data-testid={`${id}-audience`}
                          className={INPUT}
                          value={(row as TeamOverride).audience}
                          disabled={readOnly}
                          onChange={(e) => update(i, { audience: e.target.value as Audience })}
                        >
                          {AUDIENCES.map((audience) => (
                            <option key={audience} value={audience}>
                              {S.audiences[audience]}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td className="py-1 pr-2">
                      <input
                        aria-label={`${S.rowOf(i + 1)}: ${S.reason}`}
                        data-testid={`${id}-reason`}
                        className={`${INPUT} w-48`}
                        value={row.reason}
                        maxLength={500}
                        disabled={readOnly}
                        onChange={(e) => update(i, { reason: e.target.value })}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        type="date"
                        aria-label={`${S.rowOf(i + 1)}: ${S.expiresAt}`}
                        title={S.noExpiry}
                        data-testid={`${id}-expires`}
                        className={INPUT}
                        value={dateInputValue(row.expiresAt)}
                        disabled={readOnly}
                        onChange={(e) => update(i, { expiresAt: expiryFromDateInput(e.target.value) })}
                      />
                    </td>
                    <td className="py-1">
                      {!readOnly && (
                        <button type="button" data-testid={`${id}-remove`} className={BTN_SMALL} onClick={() => remove(i)}>
                          {S.remove}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {!readOnly && (
        <button type="button" data-testid={`${testId}-add`} className={`${BTN_SMALL} mt-2`} onClick={add}>
          {S.add}
        </button>
      )}
    </div>
  );
}
