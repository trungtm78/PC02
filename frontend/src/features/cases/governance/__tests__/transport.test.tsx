import { fireEvent, render, screen, waitFor } from "./render-governance";
import { expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { Button, useCommand, CommandFeedback } from "../shared";
vi.mock("@/lib/api", () => ({ api: { post: vi.fn(), patch: vi.fn() } }));
function Harness({ version }: { version: string }) {
  const command = useCommand(async () => {});
  return (
    <>
      <Button
        disabled={command.busy}
        onClick={() => {
          void command.run("/cases/c1/handoffs", {
            expectedUpdatedAt: version,
            toTeamId: "t2",
          });
        }}
      >
        Retry command
      </Button>
      <CommandFeedback command={command} />
    </>
  );
}
it("retains the business request key through an authorized version refresh after an uncertain failure", async () => {
  vi.mocked(api.post)
    .mockRejectedValueOnce(new Error("Unknown outcome"))
    .mockResolvedValueOnce({ data: { data: {} } });
  const view = render(<Harness version="2026-10-01T00:00:00Z" />);
  fireEvent.click(screen.getByRole("button", { name: "Retry command" }));
  await screen.findByRole("alert");
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Retry command" })).toBeEnabled(),
  );
  view.rerender(<Harness version="2026-10-02T00:00:00Z" />);
  fireEvent.click(screen.getByRole("button", { name: "Retry command" }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(
    (vi.mocked(api.post).mock.calls[0][1] as { requestKey: string }).requestKey,
  ).toEqual(
    (vi.mocked(api.post).mock.calls[1][1] as { requestKey: string }).requestKey,
  );
});
