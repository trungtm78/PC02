import type { ReactNode } from "react";
import {
  PolicyContext,
  useNativeFieldPolicies,
  policyPaths,
  type NativeFieldPolicy,
} from "./native-field-policy";
import { CASE_LEGACY_SPEC } from "./legacy-form-layout.def";
export function CaseFieldPolicyProvider({
  policies = [],
  children,
}: {
  policies?: readonly NativeFieldPolicy[];
  children: ReactNode;
}) {
  return (
    <PolicyContext.Provider value={policies}>{children}</PolicyContext.Provider>
  );
}
export function CasePolicyField({
  label,
  testId,
  children,
}: {
  label: string;
  testId?: string;
  children: ReactNode;
}) {
  const policies = useNativeFieldPolicies();
  const normalize = (value: string) =>
    value.toLocaleLowerCase("vi").replace(/\s+/g, " ").trim();
  const supplementalLabels: Record<string, string[]> = {
    handler: ["Điều tra viên", "Cán bộ xử lý"],
    assignedTeamId: ["Tổ điều tra", "Đội phụ trách"],
    status: ["Trạng thái"],
    caseTitle: ["Tiêu đề hồ sơ", "Tên vụ án"],
  };
  const matching = policies.filter(
    (policy) =>
      policyPaths(policy.key).some(
        (key) =>
          testId === `field-${key}` ||
          testId === `input-${key}` ||
          testId === `fk-${key}`,
      ) ||
      (CASE_LEGACY_SPEC.layout &&
        Object.values(CASE_LEGACY_SPEC.layout)
          .flat()
          .some(
            (item) =>
              policyPaths(policy.key).includes(item.field) &&
              normalize(item.caption) === normalize(label),
          )) ||
      policyPaths(policy.key).some((key) =>
        supplementalLabels[key]?.some(
          (title) => normalize(title) === normalize(label),
        ),
      ),
  );
  if (matching.some((policy) => !policy.readable)) return null;
  return matching.some((policy) => !policy.writable) ? (
    <fieldset disabled inert className="contents">
      {children}
    </fieldset>
  ) : (
    children
  );
}
