"use client";

import { usePathname } from "next/navigation";

export function TopbarCrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  return (
    <div className="crumbs">
      {parts.map((part, i) => (
        <span key={i} style={{ display: "contents" }}>
          {i > 0 && <span className="sep">/</span>}
          <span className={i === parts.length - 1 ? "leaf" : ""}>{part}</span>
        </span>
      ))}
    </div>
  );
}
