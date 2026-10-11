# scripts/

Helper scripts for local development and operations.

Most day-to-day commands are exposed as npm scripts at the repository root
(see the root `README.md`):

| Command | Purpose |
|---------|---------|
| `npm run install:all` | Install root + backend + frontend dependencies |
| `npm run db:create` | Create the database and restricted app user |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Load safe sample data |
| `npm run db:setup` | Migrate then seed |
| `npm run dev` | Run backend + frontend together |

Add shell/Node helpers here when a command is not a good fit for `package.json`.
