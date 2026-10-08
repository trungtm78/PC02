import { createContext, useContext } from "react";
import { CASE_CANONICAL_FIELDS } from "./canonical-fields";

export interface NativeFieldPolicy {
  key: string;
  sensitivity: string;
  searchable?: boolean;
  exportable?: boolean;
  readable: boolean;
  writable: boolean;
}
export const PolicyContext = createContext<readonly NativeFieldPolicy[]>([]);
export function useNativeFieldPolicies() {
  return useContext(PolicyContext);
}
const aliases: Record<string, string[]> = {
  description: ["description", "moTaChiTiet"],
  noiXayRa: ["noiXayRa", "specificAddress"],
  tenCungCap: ["tenCungCap", "reporter"],
  cccdCungCap: ["cccdCungCap", "reporterIdNumber"],
  diaChiCungCap: ["diaChiCungCap", "reporterAddress"],
  "statistic.soTienBiThietHai": ["statistic.soTienBiThietHai", "damageAmount"],
  caseTitle: ["caseTitle", "name"],
  handler: ["handler", "investigatorId"],
  investigationDeadline: ["investigationDeadline", "deadline"],
  deXuatXuLy: ["deXuatXuLy", "deXuat"],
  name: ["name", "caseTitle", "nameBd"],
  crime: ["crime", "criminalType", "crimeBd"],
  caseCode: ["caseCode", "stt"],
  deadline: ["deadline", "investigationDeadline"],
  investigatorId: ["investigatorId", "handler", "investigator"],
  assignedTeamId: ["assignedTeamId", "assignedTeam"],
};
export function policyPaths(key: string): string[] {
  const field = CASE_CANONICAL_FIELDS.find(
    (field) => field.key === key || field.column === key,
  );
  return [
    ...new Set([
      key,
      ...(field
        ? [
            field.key,
            field.column,
            field.key.split(".").pop()!,
            field.column.split(".").pop()!,
          ]
        : []),
      ...(aliases[key] ?? []),
      ...(aliases[field?.key ?? ""] ?? []),
      ...(key === "sdtCungCap"
        ? ["phone", "phoneNumber", "reporterPhone"]
        : []),
    ]),
  ];
}
export function nativeFieldAllowed(
  policies: readonly NativeFieldPolicy[] = [],
  key: string,
  operation: "readable" | "writable" = "readable",
) {
  return !policies.some(
    (policy) =>
      !policy[operation] &&
      policyPaths(policy.key).some((path) => policyPaths(key).includes(path)),
  );
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function removePath(record: Record<string, unknown>, path: string) {
  delete record[path];
  const [head, ...tail] = path.split(".");
  if (tail.length && record[head] && typeof record[head] === "object") {
    const child = { ...object(record[head]) };
    removePath(child, tail.join("."));
    record[head] = child;
  }
}
/** Remove denied native values, owned aliases, explicit clears and date provenance before serialization. */
export function omitDeniedNativeFields<T extends Record<string, unknown>>(
  input: T,
  policies: readonly NativeFieldPolicy[] = [],
  operation: "readable" | "writable" = "writable",
): T {
  const result = { ...input } as Record<string, unknown>;
  const metadata = { ...object(input.metadata) };
  for (const policy of policies.filter((policy) => !policy[operation])) {
    for (const path of policyPaths(policy.key)) {
      removePath(result, path);
      removePath(metadata, path);
      for (const key of [
        "_canonicalClears",
        "_canonicalDateSources",
        "_canonicalFallbacks",
      ]) {
        if (metadata[key]) {
          const map = { ...object(metadata[key]) };
          removePath(map, path);
          metadata[key] = map;
        }
      }
    }
  }
  if (input.metadata !== undefined) result.metadata = metadata;
  return result as T;
}

export {
  CaseFieldPolicyProvider,
  CasePolicyField,
} from "./native-field-components";
