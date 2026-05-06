const STATUS_LABELS: Record<string, string> = {
  running: "실행 중",
  active: "진행 중",
  project: "프로젝트",
  "manual outreach": "수동 아웃리치",
  manual_outreach: "수동 아웃리치",
  idle: "대기 중",
  waiting_approval: "승인 대기",
  pending: "대기",
  queued: "큐 대기",
  executing: "실행 중",
  approved: "승인됨",
  approved_waiting_execution: "실행 대기",
  waiting_manual_handoff: "수동 처리 대기",
  needs_changes: "수정 필요",
  manual_handoff: "수동 처리",
  completed: "완료",
  blocked: "차단됨",
  failed: "실패",
  rejected: "거절됨",
  warning: "주의",
  info: "정보",
  danger: "위험",
  critical: "긴급",
  ok: "정상"
};

const HEALTH_LABELS: Record<string, string> = {
  ok: "정상",
  degraded: "주의",
  failing: "장애",
  warning: "주의",
  critical: "긴급"
};

const RISK_LABELS: Record<string, string> = {
  low: "낮음",
  medium: "중간",
  high: "높음",
  critical: "긴급"
};

const APPROVAL_TYPE_LABELS: Record<string, string> = {
  bounty_submission: "바운티 제출",
  revenue_outreach: "매출 아웃리치",
  command_execution: "명령 실행",
  policy_change: "정책 변경"
};

const ROUTE_SEGMENT_LABELS: Record<string, string> = {
  dashboard: "대시보드",
  approvals: "승인",
  agents: "에이전트",
  projects: "프로젝트",
  artifacts: "산출물",
  events: "이벤트",
  policies: "정책",
  settings: "설정"
};

export function labelForStatus(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function labelForHealth(health: string): string {
  return HEALTH_LABELS[health] ?? labelForStatus(health);
}

export function labelForRisk(risk: string): string {
  return RISK_LABELS[risk] ?? labelForStatus(risk);
}

export function labelForApprovalType(type: string): string {
  return APPROVAL_TYPE_LABELS[type] ?? labelForStatus(type);
}

export function labelForRouteSegment(segment: string): string {
  return ROUTE_SEGMENT_LABELS[segment] ?? labelForStatus(segment);
}

export function labelForEventMessage(message: string): string {
  if (message.startsWith("Status ingested: ")) {
    return message.replace("Status ingested: ", "상태 수집됨: ");
  }
  if (message.startsWith("Command execution started: ")) {
    return message.replace("Command execution started: ", "명령 실행 시작: ");
  }
  if (message.startsWith("Command execution completed: ")) {
    return message.replace("Command execution completed: ", "명령 실행 완료: ");
  }
  if (message.startsWith("Command blocked by manual handoff policy: ")) {
    return message.replace("Command blocked by manual handoff policy: ", "수동 처리 정책으로 차단됨: ");
  }
  if (message.startsWith("Approval accepted: ")) {
    return message.replace("Approval accepted: ", "승인됨: ");
  }
  if (message.startsWith("Manual submission recorded: ")) {
    return message.replace("Manual submission recorded: ", "외부 제출 기록됨: ");
  }
  if (message.startsWith("Operator instruction requested: ")) {
    return message.replace("Operator instruction requested: ", "운영자 지시 등록됨: ");
  }
  if (message.startsWith("HQ delegation created: ")) {
    return message.replace("HQ delegation created: ", "HQ 하위작업 배정됨: ");
  }
  if (message.startsWith("Discord report queued: ")) {
    return message.replace("Discord report queued: ", "Discord 보고 대기열 등록됨: ");
  }
  return message;
}

export function formatDateTimeKo(value: Date | string | null | undefined): string {
  if (!value) return "보고 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value));
}

export function formatTimeKo(value: Date | string | null | undefined): string {
  if (!value) return "보고 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value));
}
