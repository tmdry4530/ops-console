import { db } from "@/lib/db";

export async function listEvents(type?: string) {
  return db.event.findMany({
    where: type ? { type } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100
  });
}
