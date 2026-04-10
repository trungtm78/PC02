/**
 * VictimsListPage — Quản lý Bị hại
 * TASK-2026-261225
 *
 * Thin wrapper around ObjectListPage with subjectType="VICTIM".
 * Pattern: Refs/pages/VictimsList.tsx (style reference)
 */

import ObjectListPage from "./ObjectListPage";

export default function VictimsListPage() {
  return <ObjectListPage subjectType="VICTIM" />;
}
