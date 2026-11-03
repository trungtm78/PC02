import type { OcrAnalysisView } from './ocrApi';

/**
 * The analysis with its field names translated to the names one form uses. The server names fields as the shared
 * layout does; the Petition and Incident forms keep some of those values under other names. Values, provenance and
 * warnings are untouched.
 */
export function mapFieldNames(
  analysis: OcrAnalysisView,
  toPath: (serverField: string) => string,
): OcrAnalysisView {
  return {
    ...analysis,
    projection: {
      fills: analysis.projection.fills.map((fill) => ({ ...fill, field: toPath(fill.field) })),
      skips: analysis.projection.skips.map((skip) => ({ ...skip, field: toPath(skip.field) })),
    },
  };
}
