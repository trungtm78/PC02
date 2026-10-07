import { useParams } from "react-router-dom";
import { CaseGovernanceWorkspace } from "./CaseGovernanceWorkspace";
export default function CaseGovernancePage() {
  const { id } = useParams();
  return id ? (
    <CaseGovernanceWorkspace key={id} caseId={id} />
  ) : (
    <p role="alert">Chưa chọn hồ sơ vụ án.</p>
  );
}
