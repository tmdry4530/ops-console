import { db } from "@/lib/db";
import { LiveEventTable } from "@/components/live-event-table";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const events = await db.event.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>이벤트</h1>
          <div className="sub">감사 로그 · SSE 실시간 스트림</div>
        </div>
        <div className="actions">
          <span className="badge ok"><span className="dot" /> Live</span>
        </div>
      </div>
      <LiveEventTable initialEvents={events} />
    </>
  );
}
