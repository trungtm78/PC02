// ─── Types for CaseForm ─────────────────────────────────────────────────────

export type TabId =
  | "info"
  | "incident"
  | "case"
  | "subjects"
  | "incident-tdc"
  | "case-tdc"
  | "evidence"
  | "business-files"
  | "statistics"
  | "media";

export interface Subject {
  id: string;
  type: "Bị can" | "Bị hại" | "Luật sư" | "Nhân chứng";
  name: string;
  idNumber: string;
  dateOfBirth: string;
  address: string;
  phone: string;
  gender?: string;
  nationality?: string;
  occupation?: string;
  criminalRecord?: string;
  detentionStatus?: string;
}

export interface Evidence {
  id: string;
  code: string;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  storageLocation: string;
  receivedDate: string;
  status: string;
  evidenceType?: string;
  entryOrder?: string;
  warehouseReceipt?: string;
}

export interface MediaFile {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadDate: string;
  uploader: string;
  recordDate?: string;
}

export interface CaseFormData {
  // ── Tab 1: Thông tin chung ──────────────────────────────────────────────
  // Thông tin hồ sơ
  caseCode: string;           // Mã hồ sơ (bắt buộc, unique, HS-YYYY-NNN)
  receiveDate: string;        // Ngày tiếp nhận (bắt buộc, không tương lai)
  receiveTime: string;        // Giờ tiếp nhận
  caseType: string;           // Loại hồ sơ (bắt buộc)
  caseTitle: string;          // Tiêu đề hồ sơ (bắt buộc)
  description: string;        // Mô tả chi tiết
  status: string;             // Trạng thái
  priority: string;           // Mức độ ưu tiên
  handler: string;            // Điều tra viên chính (bắt buộc)
  supervisingUnit: string;    // Đơn vị thụ lý
  petitionType: string;       // Loại đơn thư (từ MasterClass type 02)
  caseClassification: string; // Phân loại vụ án

  // Thông tin người tố cáo/báo tin
  reporter: string;           // Họ và tên người báo tin
  reporterIdNumber: string;   // Số CMND/CCCD
  reporterDateOfBirth: string;// Ngày sinh
  reporterGender: string;     // Giới tính
  reporterPhone: string;      // Số điện thoại
  reporterEmail: string;      // Email
  reporterAddress: string;    // Địa chỉ thường trú
  reporterNationality: string;// Quốc tịch
  reporterOccupation: string; // Nghề nghiệp
  reporterRelationToCase: string; // Quan hệ với vụ án

  // Khu vực xảy ra
  province: string;           // Tỉnh/Thành phố
  district: string;           // Quận/Huyện
  ward: string;               // Phường/Xã
  specificAddress: string;    // Địa chỉ cụ thể

  // Thông tin điều tra
  investigationStartDate: string;   // Ngày bắt đầu điều tra
  investigationDeadline: string;    // Hạn điều tra
  prosecutionOfficeAssigned: string;// VKS được phân công
  relatedCaseCode: string;          // Mã vụ án liên quan
  damageAmount: string;             // Thiệt hại ước tính
  damageDescription: string;        // Mô tả thiệt hại
  note: string;                     // Ghi chú

  // ── Tab 2: Vụ việc ─────────────────────────────────────────────────────
  incidentCode: string;
  incidentDate: string;
  incidentTime: string;
  incidentLocation: string;
  incidentDescription: string;
  incidentType: string;
  incidentLevel: string;
  incidentCause: string;
  incidentMethod: string;

  // ── Tab 3: Vụ án ────────────────────────────────────────────────────────
  criminalCode: string;
  criminalDate: string;
  criminalLocation: string;
  criminalType: string;
  criminalSecondaryType: string;
  accusation: string;
  prosecutionOffice: string;
  courtName: string;
  courtHearingDate: string;
  verdict: string;
  sentence: string;

  // ── Tab 5: Vụ việc TĐC ─────────────────────────────────────────────────
  tdcIncidentCode: string;
  tdcSource: string;
  tdcReceiveDate: string;
  tdcContent: string;
  tdcResult: string;
  tdcTransferDate: string;

  // ── Tab 6: Vụ án TĐC ────────────────────────────────────────────────────
  tdcCaseCode: string;
  tdcCaseType: string;
  tdcProcessingResult: string;
  tdcClosedDate: string;

  // ── Tab 9: Thống kê 48 trường ────────────────────────────────────────────
  // Nhóm 1: Nguồn tin
  stat_sourceType: string;
  stat_sourceOrigin: string;
  stat_informantType: string;
  stat_receiveMethod: string;
  stat_urgencyLevel: string;
  stat_reportingUnit: string;
  stat_incidentDate: string;
  stat_incidentTime: string;
  stat_incidentProvince: string;
  stat_incidentDistrict: string;
  stat_incidentWard: string;
  stat_initialClassification: string;
  // Nhóm 2: Tội phạm
  stat_primaryCrime: string;
  stat_secondaryCrime: string;
  stat_crimeField: string;
  stat_crimeMethod: string;
  stat_damageAmount: string;
  stat_recoveredAmount: string;
  stat_victimCount: string;
  stat_deathCount: string;
  stat_injuryCount: string;
  stat_propertyDamage: string;
  stat_organizedCrime: string;
  stat_repeatOffender: string;
  // Nhóm 3: Đối tượng
  stat_suspectCount: string;
  stat_suspectArrested: string;
  stat_suspectDetained: string;
  stat_suspectGender: string;
  stat_suspectAge: string;
  stat_suspectEthnicity: string;
  stat_suspectNationality: string;
  stat_suspectOccupation: string;
  stat_suspectEducation: string;
  stat_suspectCriminalRecord: string;
  stat_suspectDrugRelated: string;
  stat_suspectWeaponUsed: string;
  // Nhóm 4: Kết quả
  stat_processingStatus: string;
  stat_investigationResult: string;
  stat_prosecutionResult: string;
  stat_trialResult: string;
  stat_sentencingResult: string;
  stat_closedDate: string;
  stat_processingDays: string;
  stat_evidenceCollected: string;
  stat_witnessCount: string;
  stat_propertySeized: string;
  stat_caseTransferred: string;
  stat_reportSubmitted: string;
}

export interface TabProps {
  formData: CaseFormData;
  setFormData: React.Dispatch<React.SetStateAction<CaseFormData>>;
  errors: Record<string, string>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  /** Danh sách điều tra viên fetch từ API — dùng trong FKSelect handler */
  handlerOptions?: { value: string; label: string }[];
  handlerLoading?: boolean;
}

export const INITIAL_FORM_DATA: CaseFormData = {
  // Tab 1
  caseCode: "",
  receiveDate: "",
  receiveTime: "",
  caseType: "",
  caseTitle: "",
  description: "",
  status: "",
  priority: "",
  handler: "",
  supervisingUnit: "",
  petitionType: "",
  caseClassification: "",
  reporter: "",
  reporterIdNumber: "",
  reporterDateOfBirth: "",
  reporterGender: "",
  reporterPhone: "",
  reporterEmail: "",
  reporterAddress: "",
  reporterNationality: "Việt Nam",
  reporterOccupation: "",
  reporterRelationToCase: "",
  province: "TP. Hồ Chí Minh",
  district: "",
  ward: "",
  specificAddress: "",
  investigationStartDate: "",
  investigationDeadline: "",
  prosecutionOfficeAssigned: "",
  relatedCaseCode: "",
  damageAmount: "",
  damageDescription: "",
  note: "",
  // Tab 2
  incidentCode: "",
  incidentDate: "",
  incidentTime: "",
  incidentLocation: "",
  incidentDescription: "",
  incidentType: "",
  incidentLevel: "",
  incidentCause: "",
  incidentMethod: "",
  // Tab 3
  criminalCode: "",
  criminalDate: "",
  criminalLocation: "",
  criminalType: "",
  criminalSecondaryType: "",
  accusation: "",
  prosecutionOffice: "",
  courtName: "",
  courtHearingDate: "",
  verdict: "",
  sentence: "",
  // Tab 5
  tdcIncidentCode: "",
  tdcSource: "",
  tdcReceiveDate: "",
  tdcContent: "",
  tdcResult: "",
  tdcTransferDate: "",
  // Tab 6
  tdcCaseCode: "",
  tdcCaseType: "",
  tdcProcessingResult: "",
  tdcClosedDate: "",
  // Tab 9 – nhóm 1
  stat_sourceType: "",
  stat_sourceOrigin: "",
  stat_informantType: "",
  stat_receiveMethod: "",
  stat_urgencyLevel: "",
  stat_reportingUnit: "",
  stat_incidentDate: "",
  stat_incidentTime: "",
  stat_incidentProvince: "",
  stat_incidentDistrict: "",
  stat_incidentWard: "",
  stat_initialClassification: "",
  // nhóm 2
  stat_primaryCrime: "",
  stat_secondaryCrime: "",
  stat_crimeField: "",
  stat_crimeMethod: "",
  stat_damageAmount: "",
  stat_recoveredAmount: "",
  stat_victimCount: "",
  stat_deathCount: "",
  stat_injuryCount: "",
  stat_propertyDamage: "",
  stat_organizedCrime: "",
  stat_repeatOffender: "",
  // nhóm 3
  stat_suspectCount: "",
  stat_suspectArrested: "",
  stat_suspectDetained: "",
  stat_suspectGender: "",
  stat_suspectAge: "",
  stat_suspectEthnicity: "",
  stat_suspectNationality: "Việt Nam",
  stat_suspectOccupation: "",
  stat_suspectEducation: "",
  stat_suspectCriminalRecord: "",
  stat_suspectDrugRelated: "",
  stat_suspectWeaponUsed: "",
  // nhóm 4
  stat_processingStatus: "",
  stat_investigationResult: "",
  stat_prosecutionResult: "",
  stat_trialResult: "",
  stat_sentencingResult: "",
  stat_closedDate: "",
  stat_processingDays: "",
  stat_evidenceCollected: "",
  stat_witnessCount: "",
  stat_propertySeized: "",
  stat_caseTransferred: "",
  stat_reportSubmitted: "",
};
