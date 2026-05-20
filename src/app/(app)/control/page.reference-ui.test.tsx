// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ControlCenterPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() })
}));

const mockSummary = {
  generatedAt: new Date("2026-05-20T03:30:00.000Z"),
  summary: {
    agents: 2,
    running: 1,
    idle: 1,
    queueDepth: 3,
    activeTasks: 4,
    openApprovals: 1,
    highRiskApprovals: 1,
    incidents: 1,
    totalCostToday: 1.23,
    averageLatencyMs: 842,
    artifacts: 5,
    restrictedArtifacts: 1,
    commandsOpen: 2
  },
  monitorTotals: {},
  localSystems: {
    generatedAt: new Date("2026-05-20T03:30:00.000Z"),
    summary: { total: 2, ok: 2, degraded: 0, error: 0, unknown: 0, retired: 0, workspaceRetired: true },
    retiredSurfaces: [{ slug: "hermes-workspace", name: "Hermes Workspace", state: "retired", reason: "retired", keptAsReference: "docs only" }],
    systems: [
      {
        slug: "company-router",
        name: "Company Router",
        scope: "Company",
        owner: "Company HQ / Main",
        route: "/",
        localUrl: "http://127.0.0.1:15175/",
        healthUrl: "http://127.0.0.1:15175/api/health",
        source: "services/company-services.json",
        referencePattern: "Google Status matrix + router service cards",
        riskGate: "manifest-backed routes only",
        state: "ok",
        latencyMs: null,
        statusCode: null,
        detail: null,
        operatorAction: "정상 관찰",
        referenceOnly: false
      },
      {
        slug: "ops-console",
        name: "Ops Console",
        scope: "Company",
        owner: "Company Ops",
        route: "/ops /control",
        localUrl: "http://127.0.0.1:3010/",
        healthUrl: "http://127.0.0.1:3000/api/health",
        source: "Postgres + worker events + approvals",
        referencePattern: "LaunchDarkly traces + Windmill queue controls",
        riskGate: "approval-gated write/control",
        state: "ok",
        latencyMs: null,
        statusCode: null,
        detail: null,
        operatorAction: "정상 관찰",
        referenceOnly: false
      }
    ]
  },
  agents: [
    {
      id: "agent_dev",
      slug: "dev-agent",
      name: "Dev Agent",
      scope: "Company",
      status: "active",
      health: "ok",
      runtime: "process_live",
      runtimeLabel: "process_live",
      heartbeatAt: new Date("2026-05-20T03:29:00.000Z"),
      currentTask: "Reference UI update",
      currentTaskId: "task_1",
      model: "gpt-5.5",
      costToday: 1.23,
      tokensToday: 42000,
      latencyMs: 842,
      risk: "medium",
      queueDepth: 2,
      activeCount: 1,
      failures24h: 0,
      capabilities: ["code", "review"],
      tools: ["terminal", "file"],
      expectedStopped: false
    },
    {
      id: "agent_worker",
      slug: "design-worker-gateway",
      name: "Design Worker Gateway",
      scope: "Company",
      status: "active",
      health: "ok",
      runtime: "idle",
      runtimeLabel: "stopped by design",
      heartbeatAt: new Date("2026-05-20T03:20:00.000Z"),
      currentTask: null,
      currentTaskId: null,
      model: "unknown",
      costToday: 0,
      tokensToday: 0,
      latencyMs: null,
      risk: "low",
      queueDepth: 0,
      activeCount: 0,
      failures24h: 0,
      capabilities: [],
      tools: [],
      expectedStopped: true
    }
  ],
  tasks: [
    {
      id: "task_1",
      slug: "reference-ui-update",
      title: "레퍼런스 적용 UI 업데이트",
      status: "running",
      riskLevel: "medium",
      agentName: "Dev Agent",
      agentId: "agent_dev",
      projectName: "ops-console",
      scope: "Company",
      summary: "Apply Linear/Kiro/FloQast/LaunchDarkly references",
      blocker: null,
      nextAction: "visual QA",
      traceId: "trace_task_1",
      updatedAt: new Date("2026-05-20T03:28:00.000Z"),
      createdAt: new Date("2026-05-20T03:00:00.000Z")
    }
  ],
  approvals: [],
  highRiskApprovals: [],
  events: [
    {
      id: "evt_1",
      type: "command.execution.started",
      source: "ops",
      severity: "info",
      message: "run started",
      traceId: "trace_task_1",
      agentName: "Dev Agent",
      taskTitle: "레퍼런스 적용 UI 업데이트",
      approvalTitle: null,
      createdAt: new Date("2026-05-20T03:27:00.000Z"),
      metadata: { model: "gpt-5.5", latencyMs: 842 }
    }
  ],
  healthRows: [
    { name: "Ops API", scope: "Company", status: "ok", note: "online" },
    { name: "Worker gateway", scope: "Company", status: "stopped", note: "stopped by design · 정상" }
  ],
  traces: [
    {
      id: "trace_1",
      traceId: "trace_task_1",
      kind: "command",
      title: "run started",
      status: "succeeded",
      at: new Date("2026-05-20T03:27:00.000Z"),
      related: "Dev Agent"
    }
  ],
  incidents: [
    {
      id: "incident_1",
      severity: "minor",
      title: "Cron watchdog warning",
      affectedScope: ["Company"],
      state: "triaged",
      updatedAt: new Date("2026-05-20T03:24:00.000Z"),
      traceId: "incident_trace_1"
    }
  ],
  scopeBoundaries: [
    { scope: "Company", state: "active", rule: "Ops Console canonical state." },
    { scope: "Auth", state: "isolated", rule: "Secret/cookie/token value hidden." },
    { scope: "Crypto", state: "isolated", rule: "No live trading from Company scope." },
    { scope: "X-CDP", state: "isolated", rule: "CDP-specific tasks stay out." }
  ],
  costRows: [{ agent: "Dev Agent", model: "gpt-5.5", costToday: 1.23, tokensToday: 42000, latencyMs: 842, traceId: "task_1" }]
};

vi.mock("@/server/control-center", () => ({
  getControlCenterSummary: vi.fn(async () => mockSummary)
}));

describe("ControlCenterPage reference-driven UI", () => {
  it("applies the reference board layout: command bar, observability strip, session list, and inspector", async () => {
    render(await ControlCenterPage());

    expect(screen.getByText("Global Command Bar")).toBeInTheDocument();
    expect(screen.getByText("/route /run /approve /pause agent")).toBeInTheDocument();
    expect(screen.getByText("Observability Strip")).toBeInTheDocument();
    expect(screen.getByText("Cost/token"));
    expect(screen.getAllByText("Agent Registry Table").length).toBeGreaterThan(1);
    expect(screen.getAllByText("Session / Run Timeline").length).toBeGreaterThan(1);
    expect(screen.getByText("Right Inspector")).toBeInTheDocument();
    expect(screen.getByText(/Selected run.*tool\/model\/artifact\/verification/)).toBeInTheDocument();
    expect(screen.getByText("Kiro-style executor")).toBeInTheDocument();
    expect(screen.getByText("FloQast-style roster")).toBeInTheDocument();
    expect(screen.getByText("LaunchDarkly-style traces")).toBeInTheDocument();
    expect(screen.getByText("OpenSea-style dense grid")).toBeInTheDocument();
    expect(screen.getByText("Company-native Monitor / Manage")).toBeInTheDocument();
    expect(screen.getByText("Hermes Workspace retired")).toBeInTheDocument();
    expect(screen.queryByText("hermes-workspace")).not.toBeInTheDocument();
  });
});
