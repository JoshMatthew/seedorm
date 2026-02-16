# seedorm

Development-first ORM that lets you start with a JSON file and migrate to any SQL database by changing one line of config. No rewrites.

## Why

Every project starts the same way: you need to store data, but you don't want to set up a database just to prototype. SeedORM lets you start building immediately with a local JSON file, then switch to a real database when you're ready — without changing your application code.

## Quick start

```bash
npm install seedorm
```

```typescript
import { SeedORM, FieldType } from "seedorm";

const db = new SeedORM();
await db.connect();

const User = db.model({
  name: "User",
  collection: "users",
  schema: {
    name:  { type: FieldType.String, required: true },
    email: { type: FieldType.String, unique: true },
    role:  { type: FieldType.String, enum: ["admin", "user"], default: "user" },
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

## Relations

Define relationships between models and populate them at query time.

```typescript
import { SeedORM, FieldType, RelationType } from "seedorm";

const User = db.model({
  name: "User",
  collection: "users",
  schema: {
    name:  { type: FieldType.String, required: true },
    email: { type: FieldType.String, unique: true },
  },
  relations: {
    posts:   { type: RelationType.HasMany, model: "Post", foreignKey: "authorId" },
    profile: { type: RelationType.HasOne, model: "Profile", foreignKey: "userId" },
    roles:   { type: RelationType.ManyToMany, model: "Role", joinCollection: "user_roles", foreignKey: "userId", relatedKey: "roleId" },
  },
});

const Post = db.model({
  name: "Post",
  collection: "posts",
  schema: {
    title:    { type: FieldType.String, required: true },
    authorId: { type: FieldType.String, required: true },
  },
  relations: {
    author: { type: RelationType.BelongsTo, model: "User", foreignKey: "authorId" },
  },
});

// Populate relations with include
const user = await User.findById("usr_abc123", {
  include: ["posts", "profile", "roles"],
});

// Manage many-to-many links
await User.associate("roles", "usr_abc123", "rol_editor");
await User.dissociate("roles", "usr_abc123", "rol_editor");
```

**Relation types:** `hasOne`, `hasMany`, `belongsTo`, `manyToMany`

## Switch to a real database

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

Your models, queries, and application logic stay exactly the same. SeedORM currently supports PostgreSQL, with MySQL, SQLite, and more adapters coming soon.

## Enums

SeedORM exports string enums for type-safe definitions. Plain strings also work since the enums are string-backed.

| Enum | Values |
|------|--------|
| `FieldType` | `String`, `Number`, `Boolean`, `Date`, `Json`, `Array` |
| `RelationType` | `HasOne`, `HasMany`, `BelongsTo`, `ManyToMany` |
| `AdapterType` | `Json`, `Postgres`, `MySQL` |

## Features

- **Zero-config start** — data lives in a JSON file, no database setup needed
- **Schema validation** — type checking, required fields, unique constraints, min/max, enums
- **Relations** — `hasOne`, `hasMany`, `belongsTo`, `manyToMany` with eager loading via `include`
- **Query operators** — `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$like`, `$exists`
- **CLI tools** — `seedorm init`, `seedorm start` (REST server), `seedorm studio` (visual UI)
- **Migration engine** — `migrate create`, `migrate up`, `migrate to` (SQL export)
- **Pluggable adapters** — PostgreSQL built-in, MySQL and SQLite coming soon. Drivers are lazy-loaded and optional.
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

# Export JSON data as SQL
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
