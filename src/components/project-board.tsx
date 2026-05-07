import type { Project } from "@prisma/client";
import Link from "next/link";
import { labelForStatus } from "@/lib/korean-labels";
import { StatusBadge } from "./status-badge";

export function ProjectBoard({ projects }: { projects: Project[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}>
      {projects.map((p) => (
        <Link key={p.id} href={`/projects/${p.id}`} className="proj-card" style={{ textDecoration: "none" }}>
          <div className="row1">
            <StatusBadge label={p.revenueType ?? "project"} dot={false} />
            <span className="right muted" style={{ fontSize: 11 }}>{labelForStatus(p.status)}</span>
          </div>
          <div className="pname">{p.name}</div>
          {p.blocker && <div className="blocker-msg">{p.blocker}</div>}
          {p.nextAction ? <div className="next-action">{p.nextAction}</div> : <div className="muted" style={{ fontSize: 12.5 }}>다음 액션 미등록</div>}
        </Link>
      ))}
    </div>
  );
}
