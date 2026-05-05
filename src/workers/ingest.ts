import { logInfo } from "@/lib/logger";
import { runIngestionSkeleton } from "@/server/ingest";

const summary = await runIngestionSkeleton();
logInfo("ingestion worker skeleton completed", { sourceCount: summary.sourceCount, changed: summary.changed, skipped: summary.skipped });
