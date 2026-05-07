"use client";

import { useEffect, useState } from "react";
import type { Event } from "@prisma/client";
import { formatTimeKo, labelForEventMessage } from "@/lib/korean-labels";

type StreamPayload = { events: Event[]; generatedAt: string; iteration: number };

function severityKind(s: string) {
  if (s === "critical") return "danger";
  if (s === "warning") return "warn";
  return "muted";
}

export function LiveEventTable({ initialEvents }: { initialEvents: Event[] }) {
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [status, setStatus] = useState("연결 준비");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let gotSse = false;
    let fallback: ReturnType<typeof setInterval> | null = null;
    const pull = async () => {
      const res = await fetch("/api/events", { cache: "no-store" });
      const payload = await res.json() as { events: Event[] };
      setEvents(payload.events);
      setUpdatedAt(new Date().toISOString());
      setStatus(gotSse ? "SSE 연결됨" : "프록시 fallback · 2초 동기화");
    };
    const source = new EventSource("/api/events/stream");
    const onMessage = (message: MessageEvent) => {
      gotSse = true;
      const payload = JSON.parse(message.data) as StreamPayload;
      setEvents(payload.events);
      setUpdatedAt(payload.generatedAt);
      setStatus(message.type === "heartbeat" ? "SSE 연결됨 · 변경 없음" : "SSE 연결됨 · 업데이트 수신");
      if (fallback) {
        clearInterval(fallback);
        fallback = null;
      }
    };
    source.addEventListener("snapshot", onMessage);
    source.addEventListener("update", onMessage);
    source.addEventListener("heartbeat", onMessage);
    source.onerror = () => {
      if (!fallback) fallback = setInterval(() => void pull(), 2000);
      setStatus("SSE 재연결 중 · fallback 준비");
    };
    const fallbackTimer = setTimeout(() => {
      if (!gotSse && !fallback) {
        void pull();
        fallback = setInterval(() => void pull(), 2000);
      }
    }, 2500);
    return () => {
      clearTimeout(fallbackTimer);
      if (fallback) clearInterval(fallback);
      source.close();
    };
  }, []);

  return (
    <div className="card">
      <div className="card-head">
        <div className="title">실시간 이벤트 스트림</div>
        <div className="sub">· SSE push/poll hybrid · {status}{updatedAt ? ` · ${formatTimeKo(updatedAt)}` : ""}</div>
      </div>
      <div className="card-body flush">
        <div className="tbl-wrap">
        <table className="tbl compact-paths">
          <thead>
            <tr>
              <th style={{ width: 110 }}>Severity</th>
              <th style={{ width: 190 }}>Type</th>
              <th className="path-col">Message</th>
              <th className="date-col">Time</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td>
                  <span className={`sev ${severityKind(e.severity)}`} style={{ marginRight: 8 }} />
                  <span className="muted" style={{ fontSize: 12 }}>{e.severity}</span>
                </td>
                <td className="mono" style={{ fontSize: 12 }}>{e.type}</td>
                <td className="path-col">{labelForEventMessage(e.message)}</td>
                <td className="muted date-col">{formatTimeKo(e.createdAt)}</td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr><td colSpan={4} className="empty">No events.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
