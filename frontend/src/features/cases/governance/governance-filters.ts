export const governanceFilterKeys = [
  "investigationPhase",
  "actionCode",
  "decisionNumber",
  "decisionType",
  "decisionSourceDocumentId",
  "decisionDateFrom",
  "decisionDateTo",
  "missingData",
  "governanceQueue",
  "governanceClock",
] as const;
export function governanceFilterParams(
  params: URLSearchParams,
): Record<string, string | boolean> {
  return Object.fromEntries(
    governanceFilterKeys.flatMap((key) => {
      const value = params.get(key);
      return value
        ? [
            [
              key,
              key === "missingData" && ["true", "false"].includes(value)
                ? value === "true"
                : value,
            ],
          ]
        : [];
    }),
  );
}
