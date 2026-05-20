export type ControlResponsibilityKey = "command" | "execution" | "risk" | "systems" | "observability";

export type ControlResponsibilitySection = {
  key: ControlResponsibilityKey;
  title: string;
  ownerLabel: string;
  anchor: string;
  summary: string;
};

export const controlResponsibilitySections: ControlResponsibilitySection[] = [
  {
    key: "command",
    title: "명령 접수 / 라우팅",
    ownerLabel: "HQ / operator",
    anchor: "control-command",
    summary: "사용자 지시를 compile하고 Company 범위/위험도/대상 agent를 결정한다."
  },
  {
    key: "execution",
    title: "실행 큐 / 작업 상태",
    ownerLabel: "Worker / task runner",
    anchor: "control-execution",
    summary: "Task, queue, agent current work를 한 곳에서 본다. 직접 실행 완료 판정은 verification 이후만 허용한다."
  },
  {
    key: "risk",
    title: "위험 게이트 / 승인",
    ownerLabel: "Policy / approval gate",
    anchor: "control-risk",
    summary: "high/critical, deploy, 외부발송, paid, wallet/KYC, public disclosure는 수동/승인 게이트로 분리한다."
  },
  {
    key: "systems",
    title: "로컬 시스템 / 경계",
    ownerLabel: "Local system monitor",
    anchor: "control-systems",
    summary: "Company/Auth/Crypto/Alpha/X-CDP 서비스 상태와 scope boundary를 관찰한다."
  },
  {
    key: "observability",
    title: "관측성 / 비용 / 증거",
    ownerLabel: "Trace / cost ledger",
    anchor: "control-observability",
    summary: "event, trace, model/tool cost, artifact evidence를 secret-safe하게 조회한다."
  }
];
