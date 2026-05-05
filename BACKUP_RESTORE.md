# Backup and Restore Runbook

## Backup

```bash
./ops/backups/backup.sh
```

Backups must be stored outside the application container and protected as operational secrets.

## Restore drill

1. Stop app and workers.
2. Restore Postgres into a clean database using `./ops/backups/restore.sh <backup-file>`.
3. Run `pnpm prisma:deploy`.
4. Run app healthcheck.
5. Verify seeded/sample dashboard and approval records.

A successful restore test is required before public exposure is considered.
