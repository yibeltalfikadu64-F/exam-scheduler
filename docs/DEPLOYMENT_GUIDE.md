# Deployment guide

## 1. Prerequisites

| Tool | Version |
|------|---------|
| Node.js | >= 18 (verified on v24.21.0) |
| npm | 10+ (verified on 11.19.0) |
| MySQL / MariaDB | MySQL 8.0+ or MariaDB 10.4+ (verified on MariaDB 10.4.32) |
| Git | any recent |

## 2. Environment variables

Copy and edit the templates:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### backend/.env

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `NODE_ENV` | no | `development` | `production` enables stricter checks |
| `PORT` | no | `5000` | API port |
| `HOST` | no | `0.0.0.0` | Bind address |
| `API_PREFIX` | no | `/api/v1` | Route prefix |
| `DB_HOST` / `DB_PORT` | yes | `127.0.0.1` / `3306` | |
| `DB_USER` | yes | `exam_app` | Restricted app user |
| `DB_PASSWORD` | yes | — | App-user password |
| `DB_NAME` | yes | `exam_scheduler_db` | |
| `DB_POOL_SIZE` | no | `10` | Pool connection limit |
| `DB_ADMIN_USER` / `DB_ADMIN_PASSWORD` | for `db:create` | `root` / empty | Privileged account, used once |
| `JWT_SECRET` | yes | — | >= 32 chars in production |
| `JWT_EXPIRES_IN` / `JWT_ALGORITHM` | no | `1d` / `HS256` | |
| `BCRYPT_ROUNDS` | no | `10` | |
| `CORS_ORIGIN` | no | `http://localhost:5173` | Comma-separated allow-list |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX_REQUESTS` | no | `900000` / `300` | |
| `LOG_LEVEL` | no | `debug` (dev) | `error|warn|info|http|debug` |
| `SEED_ADMIN_*` | for seeding | — | Initial administrator |

Generate a strong secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### frontend/.env

| Variable | Notes |
|----------|-------|
| `VITE_API_BASE_URL` | Base URL of the API (public) |
| `VITE_APP_NAME` | Display name |
| `VITE_PROTOTYPE_MODE` | `true` renders the dashboard shell before auth exists |

> Only `VITE_`-prefixed values reach the browser. Never put secrets here.

## 3. Install & initialise

```bash
npm run install:all     # root + backend + frontend
npm run db:create       # creates exam_scheduler_db + restricted user
npm run db:setup        # migrate + seed
```

`db:create` connects with `DB_ADMIN_USER`/`DB_ADMIN_PASSWORD`, then:

```sql
CREATE DATABASE IF NOT EXISTS `exam_scheduler_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'exam_app'@'localhost' IDENTIFIED BY '<password>';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
  ON `exam_scheduler_db`.* TO 'exam_app'@'localhost';
```

It **never drops or truncates** anything, and it does not touch the pre-existing
`exam_scheduler` database.

## 4. Run

```bash
npm run dev            # backend (nodemon, :5000) + frontend (vite, :5173)
# or individually
npm run dev:backend
npm run dev:frontend
```

Verify:

```bash
curl http://localhost:5000/api/v1/health
```

## 5. Production build

```bash
npm run build          # -> frontend/dist
NODE_ENV=production npm run start   # backend serves the API
```

Serve `frontend/dist` behind Nginx (SPA fallback to `index.html`; see
`frontend/nginx.conf`).

## 6. Docker (unverified)

`docker-compose.yml` describes a MySQL + backend + frontend topology, but
**Docker was not installed on the machine this was built on**, so it has not
been executed. Validate it on a Docker host before relying on it:

```bash
docker compose config
docker compose up -d --build
docker compose exec backend node src/scripts/migrate.js   # if needed
```

## 7. Backups

- Logical backup:
  ```bash
  mysqldump -u exam_app -p exam_scheduler_db > backup_$(date +%F).sql
  ```
- Store backups outside the repository (`database/backup/*.sql` is gitignored).
- Restore into a **new** database, then point `DB_NAME` at it. Never restore
  over a live database without explicit approval.

## 8. Operations notes

- Logs go to stdout; use the host's process manager/journal to capture them.
- Graceful shutdown closes the HTTP server and the MySQL pool on `SIGTERM`.
- `/api/v1/health` is safe for container health checks and uptime monitors.
