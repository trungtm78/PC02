/**
 * WitnessesListPage — Quản lý Nhân chứng
 * TASK-2026-261225
 *
 * Thin wrapper around ObjectListPage with subjectType="WITNESS".
 * Pattern: Refs/pages/WitnessesList.tsx (style reference)
 */

import ObjectListPage from "./ObjectListPage";

export default function WitnessesListPage() {
  return <ObjectListPage subjectType="WITNESS" />;
}
