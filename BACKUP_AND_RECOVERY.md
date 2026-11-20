# Backup & Recovery Procedures — MindScan AI (`BACKUP_AND_RECOVERY.md`)

## 1. PostgreSQL Backup (`pg_dump`)
```powershell
pg_dump -Fc -h localhost -U postgres -d mindscan -f "mindscan_backup_$(Get-Date -Format yyyyMMdd_HHmmss).dump"
```
- Store backups encrypted on access-controlled storage; never commit `.dump` or `.sql` exports to Git.

## 2. PostgreSQL Restore (`pg_restore`)
```powershell
pg_restore -h localhost -U postgres -d mindscan --clean --if-exists mindscan_backup_YYYYMMDD_HHMMSS.dump
```
Verify schema consistency after restore:
```powershell
npm run db:migrate
```

## 3. Model Artifacts & Dataset Provenance
- Versioned model bundles (`artifacts/models/`) are verified via SHA-256 checksums in `metadata.json`.
