"use client";

import { usePathname } from "next/navigation";
import { labelForRouteSegment } from "@/lib/korean-labels";

export function TopbarCrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  return (
    <div className="crumbs">
      {parts.map((part, i) => (
        <span key={i} style={{ display: "contents" }}>
          {i > 0 && <span className="sep">/</span>}
          <span className={i === parts.length - 1 ? "leaf" : ""}>{labelForRouteSegment(part)}</span>
        </span>
      ))}
    </div>
  );
}
