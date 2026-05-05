import { Icons } from "./icons";

export function ArtifactLink({
  title,
  path,
  restricted,
  size,
  commitSha
}: {
  title: string;
  path: string | null;
  restricted: boolean;
  size?: string | null;
  commitSha?: string | null;
}) {
  if (restricted) {
    return (
      <div className="path restricted" title="Restricted by policy" style={{ width: "100%" }}>
        <span style={{ width: 13, height: 13, display: "inline-flex", flexShrink: 0 }}>{Icons.lock}</span>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
          {title} <span style={{ opacity: 0.7 }}>· restricted</span>
        </span>
      </div>
    );
  }
  return (
    <div className="path" style={{ width: "100%" }}>
      <span style={{ width: 13, height: 13, display: "inline-flex", flexShrink: 0 }}>{Icons.file}</span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{path ?? title}</span>
      {commitSha && <span className="tag">{commitSha.slice(0, 7)}</span>}
      {size && <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{size}</span>}
    </div>
  );
}
