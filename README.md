# seedorm

Development-first ORM that lets you start with a JSON file and migrate to PostgreSQL or MySQL by changing one line of config. No rewrites.

## Why

Every project starts the same way: you need to store data, but you don't want to set up a database just to prototype. SeedORM lets you start building immediately with a local JSON file, then switch to a real database when you're ready — without changing your application code.

## Quick start

```bash
npm install seedorm
```

```typescript
import { SeedORM } from "seedorm";

const db = new SeedORM();
await db.connect();

const User = db.model({
  name: "User",
  collection: "users",
  schema: {
    name:  { type: "string", required: true },
    email: { type: "string", unique: true },
    role:  { type: "string", enum: ["admin", "user"], default: "user" },
  },
});
await User.init();

// Create
const alice = await User.create({ name: "Alice", email: "alice@example.com" });

// Query with MongoDB-style operators
const admins = await User.find({
  filter: { role: { $eq: "admin" } },
  sort: { name: 1 },
  limit: 10,
});

// Update
await User.update(alice.id, { role: "admin" });

// Delete
await User.delete(alice.id);

await db.disconnect();
```

## Switch to PostgreSQL

Change your config. That's it.

```json
{
  "adapter": { "adapter": "json", "path": "./data" }
}
```

```json
{
  "adapter": { "adapter": "postgres", "url": "postgres://localhost:5432/mydb" }
}
```

Your models, queries, and application logic stay exactly the same.

## Features

- **Zero-config start** — data lives in a JSON file, no database setup needed
- **Schema validation** — type checking, required fields, unique constraints, min/max, enums
- **Query operators** — `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$like`, `$exists`
- **CLI tools** — `seedorm init`, `seedorm start` (REST server), `seedorm studio` (visual UI)
- **Migration engine** — `migrate create`, `migrate up`, `migrate to postgres` (SQL export)
- **PostgreSQL adapter** — full adapter with parameterized queries, lazy-loaded so `pg` is optional
- **TypeScript** — written in TypeScript with full type exports, dual CJS/ESM output

## CLI

```bash
# Initialize a project
npx seedorm init

# Start a REST API dev server (port 4100)
npx seedorm start

# Launch the visual data browser (port 4200)
npx seedorm studio

# Create a migration
npx seedorm migrate create add-users

# Run pending migrations
npx seedorm migrate up

# Export JSON data as PostgreSQL SQL
npx seedorm migrate to postgres --output export.sql
```

## REST API

When running `seedorm start`, the following endpoints are available:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/models` | Register a model |
| `GET` | `/api/collections` | List collections |
| `GET` | `/api/:collection` | List documents (supports `?filter=`, `?sort=`, `?limit=`, `?offset=`) |
| `GET` | `/api/:collection/:id` | Get document by ID |
| `POST` | `/api/:collection` | Create document |
| `PATCH` | `/api/:collection/:id` | Update document |
| `DELETE` | `/api/:collection/:id` | Delete document |

## Requirements

- Node.js 18+
- `pg` (optional, only needed for PostgreSQL adapter)
- `mysql2` (optional, only needed for MySQL adapter)

## License

Apache 2.0 — see [LICENSE](./LICENSE)
