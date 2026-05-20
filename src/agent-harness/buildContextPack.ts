export function buildContextPack(input: { taskId: string; title: string; summary?: string | null }) { return { taskId: input.taskId, title: input.title, summary: input.summary ?? null }; }
