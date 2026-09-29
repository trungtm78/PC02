import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { INITIAL_FORM_DATA } from "../types";
import { cloneCaseState } from "../clone-case";

afterEach(() => vi.restoreAllMocks());

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn((path: string) => {
      if (path.endsWith("/subjects"))
        return Promise.resolve({
          data: {
            data: [
              { id: "old-subject", type: "SUSPECT", fullName: "Copied person" },
            ],
          },
        });
      if (path.endsWith("/evidences"))
        return Promise.resolve({
          data: {
            data: [
              { id: "old-evidence", code: "E-1", name: "Copied evidence" },
            ],
          },
        });
      return Promise.resolve({
        data: {
          data: {
            ...INITIAL_FORM_DATA,
            id: "case-source",
            caseCode: "OLD-001",
            name: "Copied case",
            caseProvenance: "UY_THAC_DIEU_TRA",
            soQuyetDinhUyThac: "DEC-OLD",
            nhanXet: "Copied comment",
            updatedAt: "2026-09-01T00:00:00Z",
            metadata: { extra: "copied" },
            quyenGhi: true,
          },
        },
      });
    }),
    post: vi.fn(),
    put: vi.fn(),
  },
  authApi: { me: vi.fn() },
}));
vi.mock("@/hooks/usePermission", () => ({
  usePermission: () => ({ canCreate: () => true, canEdit: () => true }),
}));
vi.mock("@/hooks/useOfficerOptions", () => ({
  useOfficerOptions: () => ({ data: [], isLoading: false }),
}));
vi.mock("@/hooks/useFormDefaults", () => ({
  useFormDefaults: () => ({ isLoaded: false }),
}));
vi.mock("@/features/document-numbers/api", () => ({
  documentNumbersApi: {
    draft: vi.fn().mockResolvedValue({ previewNumber: "NEW-001" }),
  },
}));
vi.mock("../PreSaveSummaryModal", () => ({
  PreSaveSummaryModal: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? <button data-testid="confirm-case-save" onClick={onConfirm}>Confirm</button> : null,
}));
vi.mock("../tabs", () => {
  const Noop = () => null;
  const TabInfo = ({ formData }: { formData: typeof INITIAL_FORM_DATA }) => (
    <div data-testid="case-form-title">{formData.caseTitle}</div>
  );
  return {
    TabInfo,
    TabIncident: Noop,
    TabCase: Noop,
    TabSubjects: Noop,
    TabIncidentTDC: Noop,
    TabCaseTDC: Noop,
    TabEvidence: Noop,
    TabBusinessFiles: Noop,
    TabStatistics: Noop,
    TabMedia: Noop,
    TabUyThac: Noop,
  };
});

function CloneStateProbe() {
  const location = useLocation();
  const state = location.state as {
    cloneCase: {
      formData: typeof INITIAL_FORM_DATA;
      subjects: { id: string; name: string }[];
      evidences: { id: string; name: string }[];
      originalDecisionNumber: string;
    };
  };
  return <pre data-testid="clone-state">{JSON.stringify(state.cloneCase)}</pre>;
}

describe("CaseFormPage clone navigation", () => {
  it("keeps the form open when the user cancels the back confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { default: CaseFormPage } = await import("../index");
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/cases/case-source/edit"]}>
          <Routes>
            <Route path="/cases/:id/edit" element={<CaseFormPage />} />
            <Route path="/cases" element={<div data-testid="case-list" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByTestId("btn-back"));

    expect(window.confirm).toHaveBeenCalledOnce();
    expect(screen.getByTestId("btn-back")).toBeInTheDocument();
    expect(screen.queryByTestId("case-list")).not.toBeInTheDocument();
  });

  it("loads persisted children and carries full editable state to the matching create route", async () => {
    const { default: CaseFormPage } = await import("../index");
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/cases/case-source/edit"]}>
          <Routes>
            <Route path="/cases/:id/edit" element={<CaseFormPage />} />
            <Route path="/cases/new" element={<CloneStateProbe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByTestId("btn-clone-case"));
    const state = await screen.findByTestId("clone-state");
    const clone = JSON.parse(state.textContent ?? "{}") as {
      formData: typeof INITIAL_FORM_DATA;
      subjects: { id: string; name: string }[];
      evidences: { id: string; name: string }[];
      originalDecisionNumber: string;
    };
    expect(clone.formData).toMatchObject({
      caseCode: "",
      caseTitle: "Copied case",
      nhanXet: "Copied comment",
      caseProvenance: "UY_THAC_DIEU_TRA",
    });
    expect(clone.subjects).toEqual([
      expect.objectContaining({ name: "Copied person" }),
    ]);
    expect(clone.evidences).toEqual([
      expect.objectContaining({ name: "Copied evidence" }),
    ]);
    expect(clone.subjects[0].id).not.toBe("old-subject");
    expect(clone.originalDecisionNumber).toBe("DEC-OLD");
    await waitFor(() =>
      expect(vi.mocked(api.get)).toHaveBeenCalledWith(
        "/cases/case-source/evidences",
      ),
    );
  });

  it("loads clone input before an old draft and keeps the copied title on the create form", async () => {
    const { default: CaseFormPage } = await import("../index");
    const cloned = cloneCaseState(
      {
        formData: {
          ...INITIAL_FORM_DATA,
          caseTitle: "Copied title",
          caseProvenance: "UY_THAC_DIEU_TRA",
          utdt_soQuyetDinhUyThac: "DEC-OLD",
        },
        parityState: {},
        metaState: {},
        subjects: [],
        evidences: [],
      },
      (kind, index) => `${kind}-${index}`,
    );
    localStorage.setItem(
      "caseFormDraft:delegation",
      JSON.stringify({
        formData: { ...INITIAL_FORM_DATA, caseTitle: "Old draft" },
      }),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    try {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter
            initialEntries={[
              {
                pathname: "/cases/new",
                search: "?caseProvenance=UY_THAC_DIEU_TRA",
                state: { cloneCase: cloned },
              },
            ]}
          >
            <Routes>
              <Route path="/cases/new" element={<CaseFormPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
      expect(
        await screen.findByTestId("case-clone-review"),
      ).toBeInTheDocument();
      expect(await screen.findByTestId("case-form-title")).toHaveTextContent(
        "Copied title",
      );
      expect(screen.queryByText("Old draft")).not.toBeInTheDocument();
    } finally {
      localStorage.removeItem("caseFormDraft:delegation");
    }
  });
  it("offers real file staging on a new delegation", async () => {
    const { default: CaseFormPage } = await import("../index");
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/cases/new?caseProvenance=UY_THAC_DIEU_TRA"]}>
          <Routes><Route path="/cases/new" element={<CaseFormPage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByText("Hồ sơ nghiệp vụ"));
    expect(await screen.findByTestId("case-create-documents-stage")).toBeInTheDocument();
    expect(screen.getByTestId("stage-file-input")).toBeInTheDocument();
  });
  it("retries a failed upload without creating a second delegation", async () => {
    vi.spyOn(window, "alert").mockImplementation(() => {});
    const { default: CaseFormPage } = await import("../index");
    const cloned = cloneCaseState({
      formData: {
        ...INITIAL_FORM_DATA,
        caseProvenance: "UY_THAC_DIEU_TRA",
        receiveDate: "2026-09-01",
        caseTitle: "Delegation with attachment",
        handler: "officer-1",
        utdt_donViGiao: "Granting unit",
        utdt_soQuyetDinhUyThac: "DEC-OLD",
      },
      parityState: {}, metaState: {}, subjects: [], evidences: [],
    }, (kind, index) => `${kind}-${index}`);
    cloned.formData.utdt_soQuyetDinhUyThac = "DEC-NEW";
    let uploadAttempts = 0;
    vi.mocked(api.post).mockImplementation((path: string) => {
      if (path === "/cases") return Promise.resolve({ data: { data: { id: "case-created", updatedAt: "2026-09-01T00:00:00Z" } } });
      if (path === "/documents") {
        uploadAttempts += 1;
        return uploadAttempts === 1
          ? Promise.reject(new Error("temporary upload failure"))
          : Promise.resolve({ data: { data: { id: "document-created" } } });
      }
      return Promise.reject(new Error(`unexpected POST ${path}`));
    });
    vi.mocked(api.put).mockResolvedValue({ data: { data: { updatedAt: "2026-09-02T00:00:00Z" } } });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[{ pathname: "/cases/new", search: "?caseProvenance=UY_THAC_DIEU_TRA", state: { cloneCase: cloned } }]}>
          <Routes>
            <Route path="/cases/new" element={<CaseFormPage />} />
            <Route path="/cases" element={<div data-testid="case-list" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByTestId("stage-file-input"), {
      target: { files: [new File(["file"], "delegation.pdf", { type: "application/pdf" })] },
    });
    fireEvent.click(screen.getByTestId("btn-save"));
    fireEvent.click(await screen.findByTestId("confirm-case-save"));
    expect(await screen.findByTestId("stage-retry")).toBeInTheDocument();
    expect(vi.mocked(api.post).mock.calls.filter(([path]) => path === "/cases")).toHaveLength(1);
    fireEvent.click(screen.getByTestId("stage-retry"));
    await waitFor(() => expect(screen.queryByTestId("stage-retry")).not.toBeInTheDocument());
    fireEvent.click(screen.getByTestId("btn-save"));
    await waitFor(() => expect(vi.mocked(api.put)).toHaveBeenCalledWith("/cases/case-created", expect.anything()));
    expect(vi.mocked(api.post).mock.calls.filter(([path]) => path === "/cases")).toHaveLength(1);
  });
});
