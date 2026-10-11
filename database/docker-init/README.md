# docker-init/

Placeholder for the MySQL container's `/docker-entrypoint-initdb.d` directory
(referenced by `docker-compose.yml`).

The MySQL entrypoint only executes top-level `*.sql` files found here, in
alphabetical order, and only on first initialization of an empty data volume.
Because this project relies on **ordered, tracked** migrations, the recommended
flow is:

```bash
docker compose up -d
# wait for MySQL to be healthy, then from the host:
npm run db:create
npm run db:migrate
npm run db:seed
```

If you prefer fully automated initialization, copy a single combined SQL file
into this directory before first startup. It will not be tracked by
`schema_migrations`.
