import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CrimeSelect } from "../CrimeSelect";

Element.prototype.scrollIntoView = vi.fn();

/**
 * Danh sách tội danh về `null` chứ không phải `undefined`.
 *
 * Giá trị mặc định của tham số (`data: all = []`) CHỈ chạy với `undefined`. Với `null` thì
 * `all.find(...)` ném lỗi ngay trong lúc dựng, và vì ô này nằm ở tab Thông tin của form vụ
 * án nên cả trang trắng. Ca kiểm riêng một tệp vì bản giả của hook khai ở cấp tệp.
 */
vi.mock("@/hooks/useCrimeOptions", () => ({
  useCrimeOptions: () => ({ data: null, isLoading: false }),
}));

describe("CrimeSelect khi danh sách tội danh chưa nạp được", () => {
  it("vẫn dựng được ô, không làm trắng trang", () => {
    render(<CrimeSelect label="Tội danh chính" value="crime-1" onChange={() => {}} />);
    expect(screen.getByTestId("crime-select-trigger")).toBeTruthy();
  });
});
