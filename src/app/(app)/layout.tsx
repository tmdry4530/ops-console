import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pendingCount = await db.approval.count({ where: { status: "pending" } });
  return <AppShell pendingCount={pendingCount}>{children}</AppShell>;
}
