export function promoteMemoryCandidate(summary: string): { target: "memory"; summary: string; status: "candidate" } { return { target: "memory", summary, status: "candidate" }; }
