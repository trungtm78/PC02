import { render, screen } from "./render-governance";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { HandoffPanel } from "../HandoffPanel";
import { emptyWorkspace, type WorkspaceData } from "../shared";

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

const version = "2026-10-06T01:00:00.000Z";

function withPendingHandoff(handoff: Record<string, unknown>): WorkspaceData {
  return {
    ...emptyWorkspace,
    capabilities: {
      ...emptyWorkspace.capabilities,
      enabled: true,
      operate: true,
      canEdit: false,
      pendingHandoff: true,
      actorId: "actor1",
      caseAccessMode: "INTERNAL",
    },
    snapshot: {
      caseId: "c1",
      updatedAt: version,
      intakeStage: "CHO_NHAN",
      events: [],
      handoffs: [
        { id: "h1", state: "PENDING", updatedAt: version, ...handoff },
      ],
    },
  } as WorkspaceData;
}

beforeEach(() => {
  vi.clearAllMocks();
  // The picker list holds ACTIVE teams only: the paused team below is deliberately not in it.
  vi.mocked(api.get).mockImplementation(async (url) => ({
    data: {
      data: url === "/teams/options" ? [{ id: "t1", name: "Active team" }] : [],
    },
  }));
});

it("names a handoff's teams from the record, so a team paused since is not shown as unverified", async () => {
  render(
    <HandoffPanel
      caseId="c1"
      data={withPendingHandoff({
        fromTeamId: "t1",
        toTeamId: "t-paused",
        fromTeam: { id: "t1", name: "Active team" },
        toTeam: { id: "t-paused", name: "Paused team" },
      })}
      refresh={async () => {}}
    />,
  );

  expect(await screen.findByText(/Paused team/)).toBeInTheDocument();
  expect(screen.queryByText(/Đội chưa xác minh/)).toBeNull();
});

it("still falls back to the picker list when an older response carries no team objects", async () => {
  render(
    <HandoffPanel
      caseId="c1"
      data={withPendingHandoff({ fromTeamId: "t1", toTeamId: "t1" })}
      refresh={async () => {}}
    />,
  );

  expect(await screen.findAllByText(/Active team/)).not.toHaveLength(0);
});
