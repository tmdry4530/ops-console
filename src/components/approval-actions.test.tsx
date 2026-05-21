// @vitest-environment jsdom

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApprovalActions } from "./approval-actions";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh })
}));

describe("ApprovalActions", () => {
  beforeEach(() => {
    refresh.mockClear();
    vi.restoreAllMocks();
  });

  it("renders compact audited controls for the control center", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ApprovalActions
        approvalId="appr_123"
        status="pending"
        manualReportId={null}
        variant="compact"
        riskLevel="high"
      />
    );

    expect(screen.getByText("감사 로그 승인"));
    expect(screen.getByText("high-risk · manual gate respected"));

    await userEvent.click(screen.getByRole("button", { name: "승인" }));
    expect(screen.getByText("승인 및 실행 큐 등록"));

    await userEvent.click(screen.getByRole("button", { name: "승인 확정" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/approvals/appr_123/approve", expect.objectContaining({ method: "POST" }));
      expect(refresh).toHaveBeenCalled();
    });
  });
});
