# protodb

Development-first ORM that lets you start with a JSON file and migrate to PostgreSQL or MySQL by changing one line of config. No rewrites.

## Why

Every project starts the same way: you need to store data, but you don't want to set up a database just to prototype. Protodb lets you start building immediately with a local JSON file, then switch to a real database when you're ready — without changing your application code.

## Quick start

```bash
git clone https://github.com/example/protodb.git
cd protodb
npm install
npm run build
```

```typescript
import { ProtoDB } from "protodb";

const db = new ProtoDB();
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
- **CLI tools** — `protodb init`, `protodb start` (REST server), `protodb studio` (visual UI)
- **Migration engine** — `migrate create`, `migrate up`, `migrate to postgres` (SQL export)
- **PostgreSQL adapter** — full adapter with parameterized queries, lazy-loaded so `pg` is optional
- **TypeScript** — written in TypeScript with full type exports, dual CJS/ESM output

## CLI

```bash
# Initialize a project
protodb init

# Start a REST API dev server (port 4100)
protodb start

# Launch the visual data browser (port 4200)
protodb studio

# Create a migration
protodb migrate create add-users

# Run pending migrations
protodb migrate up

# Export JSON data as PostgreSQL SQL
protodb migrate to postgres --output export.sql
```

## REST API

When running `protodb start`, the following endpoints are available:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/models` | Register a model |
| `GET` | `/api/collections` | List collections |
| `GET` | `/api/:collection` | List documents (supports `?filter=`, `?sort=`, `?limit=`, `?offset=`) |
| `GET` | `/api/:collection/:id` | Get document by ID |
| `POST` | `/api/:collection` | Create document |
| `PATCH` | `/api/:collection/:id` | Update document |
| `DELETE` | `/api/:collection/:id` | Delete document |

## Project structure

```
src/
├── index.ts                    # Public exports
├── protodb.ts                  # Main ProtoDB class
├── types.ts                    # All TypeScript interfaces
├── errors.ts                   # Error classes
├── model/
│   ├── model.ts                # Model class (CRUD + validation)
│   ├── schema.ts               # Schema parsing + validation
│   └── field-types.ts          # Type definitions + coercion
├── adapters/
│   ├── json/
│   │   ├── json-adapter.ts     # JSON file adapter
│   │   ├── file-engine.ts      # Atomic read/write with write queue
│   │   └── indexer.ts          # In-memory indexes for unique/indexed fields
│   └── postgres/
│       ├── postgres-adapter.ts # Full PostgreSQL adapter
│       ├── pg-query-builder.ts # Parameterized query builder
│       └── pg-connection.ts    # Connection pool wrapper
├── query/
│   ├── operators.ts            # Filter operator implementations
│   └── filter.ts               # In-memory filter engine
├── migration/
│   ├── migration-engine.ts     # Run/track migrations
│   ├── migration-generator.ts  # Generate migration files
│   ├── schema-differ.ts        # Diff schemas into migration steps
│   └── exporters/
│       └── postgres-exporter.ts # Generate CREATE TABLE + INSERT SQL
├── cli/
│   ├── index.ts                # Commander.js program setup
│   └── commands/               # init, start, studio, migrate:*
└── studio/
    ├── server.ts               # HTTP server for studio UI
    ├── api.ts                  # REST API routes
    └── static/                 # Vanilla HTML/CSS/JS frontend
```

## Testing

```bash
npm test          # 48 tests (unit + integration)
npm run build     # TypeScript build via tsup
```

## Requirements

- Node.js 18+
- `pg` (optional, only for PostgreSQL adapter)
- `mysql2` (optional, only for MySQL adapter)

## Status

Early development. The JSON adapter and core ORM are functional and tested. PostgreSQL adapter is implemented but untested against a live database. MySQL adapter is not yet implemented.

## License

MIT
