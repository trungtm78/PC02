import { describe, it, expect } from "vitest";
import { canProsecuteIncident } from "../incident-business-readiness";

describe("A03: prosecution eligibility in all existing entry points", () => {
  it.each(["DANG_XAC_MINH", "DA_PHAN_CONG", "PHUC_HOI_NGUON_TIN"])(
    "received %s is eligible",
    (status) => {
      expect(canProsecuteIncident({ status, intakeStage: "DA_NHAN" })).toBe(
        true,
      );
      expect(canProsecuteIncident({ status, intakeStage: null })).toBe(true);
    },
  );
  it.each(["PHAN_LOAI", "CHO_NHAN"])(
    "restored intake %s is not eligible",
    (intakeStage) => {
      expect(
        canProsecuteIncident({ status: "PHUC_HOI_NGUON_TIN", intakeStage }),
      ).toBe(false);
    },
  );
  it.each(["TIEP_NHAN", "TAM_DINH_CHI", "KHONG_KHOI_TO", "DA_CHUYEN_VU_AN"])(
    "rejects %s",
    (status) => {
      expect(canProsecuteIncident({ status })).toBe(false);
    },
  );
});
