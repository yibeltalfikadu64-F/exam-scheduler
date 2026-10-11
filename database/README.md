# database/

SQL assets for MySQL / MariaDB.

```
database/
├── migrations/   ordered, idempotent DDL applied by `npm run db:migrate`
├── seeds/        idempotent reference data applied by `npm run db:seed`
└── docker-init/  placeholder for docker-compose's MySQL init directory
```

## How migrations run

`backend/src/scripts/migrate.js` reads every `migrations/*.sql` file in filename
order and records applied files in the `schema_migrations` table. Only new files
are executed, so re-running `npm run db:migrate` is safe.

MySQL/MariaDB implicitly commit DDL, so migrations are **not** wrapped in a
transaction. Every file is written to be additive and idempotent
(`CREATE TABLE IF NOT EXISTS`, guarded `ALTER ... ADD CONSTRAINT`).

## Conventions

- Tables are `snake_case` and plural.
- Foreign keys are `<entity>_id` with explicit `ON DELETE` / `ON UPDATE` rules.
- `created_at` / `updated_at` use `DATETIME` defaults; `updated_at` uses
  `ON UPDATE CURRENT_TIMESTAMP` (no triggers).
- Enumerations use `ENUM`.
- Seeds contain **no real personal information**.
- Never run `DROP DATABASE`, `TRUNCATE`, or destructive statements automatically.

## Tables

See `docs/DATABASE_SCHEMA.md` for the full entity list and relationships.
