import { notFound } from "next/navigation";
import type { Route } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { loadProjectConversationRegistry } from "@/server/project-conversations";

export const dynamic = "force-dynamic";

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

function messageKindLabel(kind: string) {
  if (kind === "task") return "작업";
  if (kind === "artifact") return "산출물";
  return "이벤트";
}

export default async function ProjectConversationsPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ threadKey?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const registry = await loadProjectConversationRegistry(id);
  if (!registry) notFound();

  const selected = registry.conversations.find((conversation) => conversation.threadKey === query.threadKey) ?? registry.conversations[0] ?? null;

  return (
    <>
      <div className="page-head">
        <div className="titles">
          <div className="row" style={{ gap: 8, marginBottom: 6 }}>
            <Link href={`/projects/${id}` as Route} className="btn ghost sm">← 프로젝트</Link>
            <span className="badge info"><span className="dot" />Project threads</span>
          </div>
          <h1>{registry.projectName} conversations</h1>
          <div className="sub">
            projectSlug/agentSlug/workstream 기준으로 재사용되는 에이전트별 대화 표면입니다. Gateway는 router/report, 메모리 소유자는 role profile입니다.
          </div>
        </div>
      </div>

      {!registry.enabled && (
        <div className="card">
          <div className="card-body">
            <div style={{ fontWeight: 600, marginBottom: 6 }}>대화 표면 비활성</div>
            <div className="muted">{registry.emptyReason}</div>
          </div>
        </div>
      )}

      {registry.enabled && registry.conversations.length === 0 && (
        <div className="card">
          <div className="card-body">
            <div style={{ fontWeight: 600, marginBottom: 6 }}>아직 대화가 없습니다</div>
            <div className="muted">
              운영자 지시, worker task, artifact, discord.report.queued 이벤트가 projectSlug/agentSlug/workstream metadata를 갖게 되면 같은 threadKey로 계속 재사용됩니다.
              새 per-run thread를 만들지 않고 안정적인 project/agent/workstream surface에 쌓입니다.
            </div>
          </div>
        </div>
      )}

      {registry.enabled && registry.conversations.length > 0 && (
        <div className="grid-12">
          <div className="span-4 vstack" style={{ gap: 10 }}>
            {registry.conversations.map((conversation) => {
              const active = selected?.threadKey === conversation.threadKey;
              const href = `/projects/${id}/conversations?threadKey=${encodeURIComponent(conversation.threadKey)}` as Route;
              return (
                <Link
                  key={conversation.threadKey}
                  href={href}
                  className="card"
                  style={{
                    display: "block",
                    borderColor: active ? "var(--accent-line)" : "var(--line-1)",
                    background: active ? "linear-gradient(135deg,var(--accent-soft),var(--bg-1) 45%)" : "var(--bg-1)"
                  }}
                >
                  <div className="card-body" style={{ padding: 14 }}>
                    <div className="between" style={{ gap: 10, alignItems: "flex-start" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 650, color: "var(--text-0)" }}>{conversation.title}</div>
                        <div className="mono muted" style={{ fontSize: 11, marginTop: 4 }}>{conversation.threadKey}</div>
                      </div>
                      <StatusBadge label={conversation.status} />
                    </div>
                    <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                      <span className="tag">{conversation.agentSlug}</span>
                      <span className="tag">{conversation.workstream}</span>
                      <span className="tag">{conversation.messages.length} cards</span>
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>최근 활동 {formatTime(conversation.lastActivityAt)}</div>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="span-8">
            {selected && (
              <div className="card">
                <div className="card-head">
                  <div>
                    <div className="title">{selected.title}</div>
                    <div className="sub mono">{selected.threadKey}</div>
                  </div>
                  <div className="right"><StatusBadge label={selected.status} /></div>
                </div>
                <div className="card-body">
                  <div className="grid-12" style={{ marginBottom: 16 }}>
                    <div className="span-4"><div className="path" title={`threadPolicy: ${selected.threadPolicy}`} style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}><span className="sev ok" /> threadPolicy: {selected.threadPolicy}</div></div>
                    <div className="span-4"><div className="path" title={`memoryOwner: ${selected.memoryOwner}`} style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}><span className="sev info" /> memoryOwner: {selected.memoryOwner}</div></div>
                    <div className="span-4"><div className="path" title={`contextOwner: ${selected.contextOwner}`} style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}><span className="sev info" /> contextOwner: {selected.contextOwner}</div></div>
                  </div>

                  <div className="vstack" style={{ gap: 12 }}>
                    {selected.messages.map((message) => (
                      <div key={`${message.kind}:${message.id}`} className="card" style={{ background: "var(--bg-2)", borderColor: "var(--line-2)" }}>
                        <div className="card-body" style={{ padding: 14 }}>
                          <div className="between" style={{ gap: 10, alignItems: "flex-start" }}>
                            <div>
                              <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                                <span className="badge muted">{messageKindLabel(message.kind)}</span>
                                {message.status && <StatusBadge label={message.status} />}
                                {message.severity && <span className="tag">{message.severity}</span>}
                              </div>
                              <div style={{ fontWeight: 600 }}>{message.title}</div>
                              {message.body && <div className="muted" style={{ marginTop: 6 }}>{message.body}</div>}
                              {message.path && <div className="mono muted" style={{ marginTop: 6, fontSize: 11 }}>{message.path}</div>}
                            </div>
                            <div className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{formatTime(message.createdAt)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
