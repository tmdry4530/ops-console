const STATUS_LABELS: Record<string, string> = {
  running: "실행 중",
  idle: "대기 중",
  waiting_approval: "승인 대기",
  pending: "대기",
  approved: "승인됨",
  approved_waiting_execution: "실행 대기",
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

export function labelForStatus(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function labelForHealth(health: string): string {
  return HEALTH_LABELS[health] ?? labelForStatus(health);
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
