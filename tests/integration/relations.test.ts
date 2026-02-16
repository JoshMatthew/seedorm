import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { SeedORM } from "../../src/seedorm.js";

let tmpDir: string;
let db: SeedORM;

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seedorm-relint-"));
  db = new SeedORM({ adapter: { adapter: "json", path: tmpDir } });
  await db.connect();
});

afterEach(async () => {
  await db.disconnect();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("Relations — integration", () => {
  it("end-to-end: User → Posts → Tags with all relation types", async () => {
    // Define models
    const User = db.model({
      name: "IntUser",
      collection: "int_users",
      schema: {
        name: { type: "string", required: true },
        email: { type: "string", unique: true },
      },
      relations: {
        posts: { type: "hasMany", model: "IntPost", foreignKey: "authorId" },
        profile: { type: "hasOne", model: "IntProfile", foreignKey: "userId" },
      },
    });

    const Post = db.model({
      name: "IntPost",
      collection: "int_posts",
      schema: {
        title: { type: "string", required: true },
        authorId: { type: "string", required: true, index: true },
      },
      relations: {
        author: { type: "belongsTo", model: "IntUser", foreignKey: "authorId" },
        tags: {
          type: "manyToMany",
          model: "IntTag",
          joinCollection: "int_post_tags",
          foreignKey: "postId",
          relatedKey: "tagId",
        },
      },
    });

    const Profile = db.model({
      name: "IntProfile",
      collection: "int_profiles",
      schema: {
        bio: { type: "string" },
        userId: { type: "string", required: true },
      },
    });

    const Tag = db.model({
      name: "IntTag",
      collection: "int_tags",
      schema: {
        label: { type: "string", required: true },
      },
    });

    await User.init();
    await Post.init();
    await Profile.init();
    await Tag.init();

    // Create join collection
    const adapter = db.getAdapter();
    await adapter.createCollection("int_post_tags", {});

    // Create data
    const alice = await User.create({ name: "Alice", email: "alice@test.com" });
    const bob = await User.create({ name: "Bob", email: "bob@test.com" });

    await Profile.create({ bio: "Alice is a developer", userId: alice.id });

    const post1 = await Post.create({ title: "Hello World", authorId: alice.id });
    const post2 = await Post.create({ title: "SeedORM Guide", authorId: alice.id });
    const post3 = await Post.create({ title: "Bob's Post", authorId: bob.id });

    const tagTS = await Tag.create({ label: "TypeScript" });
    const tagJS = await Tag.create({ label: "JavaScript" });
    const tagORM = await Tag.create({ label: "ORM" });

    await Post.associate(post1.id, "tags", tagTS.id);
    await Post.associate(post1.id, "tags", tagORM.id);
    await Post.associate(post2.id, "tags", tagTS.id);
    await Post.associate(post3.id, "tags", tagJS.id);

    // Query User with posts + profile
    const users = await User.find({ include: ["posts", "profile"] });
    expect(users).toHaveLength(2);

    const aliceResult = users.find((u) => u.name === "Alice")!;
    expect(aliceResult.posts).toHaveLength(2);
    expect(aliceResult.profile).toBeTruthy();
    expect((aliceResult.profile as any).bio).toBe("Alice is a developer");

    const bobResult = users.find((u) => u.name === "Bob")!;
    expect(bobResult.posts).toHaveLength(1);
    expect(bobResult.profile).toBeNull();

    // Query Post with author (belongsTo)
    const post = await Post.findOne({ title: "Hello World" }, { include: ["author"] });
    expect(post).toBeTruthy();
    expect((post!.author as any).name).toBe("Alice");

    // Query Post with tags (manyToMany)
    const postsWithTags = await Post.find({ include: ["tags"] });
    const p1 = postsWithTags.find((p) => p.title === "Hello World")!;
    expect(p1.tags).toHaveLength(2);
    expect((p1.tags as any[]).map((t) => t.label).sort()).toEqual(["ORM", "TypeScript"]);

    const p3 = postsWithTags.find((p) => p.title === "Bob's Post")!;
    expect(p3.tags).toHaveLength(1);
    expect((p3.tags as any[])[0].label).toBe("JavaScript");

    // Dissociate a tag
    await Post.dissociate(post1.id, "tags", tagORM.id);
    const refreshed = await Post.findById(post1.id, { include: ["tags"] });
    expect(refreshed!.tags).toHaveLength(1);
    expect((refreshed!.tags as any[])[0].label).toBe("TypeScript");

    // findById with include
    const userById = await User.findById(alice.id, { include: ["posts"] });
    expect(userById).toBeTruthy();
    expect(userById!.posts).toHaveLength(2);
  });

  it("handles empty relations gracefully", async () => {
    const User = db.model({
      name: "EmptyUser",
      collection: "empty_users",
      schema: { name: { type: "string", required: true } },
      relations: {
        posts: { type: "hasMany", model: "EmptyPost", foreignKey: "authorId" },
      },
    });
    await User.init();

    const _Post = db.model({
      name: "EmptyPost",
      collection: "empty_posts",
      schema: {
        title: { type: "string", required: true },
        authorId: { type: "string", required: true },
      },
    });
    await _Post.init();

    const user = await User.create({ name: "Lonely" });
    const found = await User.findById(user.id, { include: ["posts"] });
    expect(found!.posts).toEqual([]);
  });

  it("find without include returns plain docs", async () => {
    const User = db.model({
      name: "PlainUser",
      collection: "plain_users",
      schema: { name: { type: "string", required: true } },
      relations: {
        posts: { type: "hasMany", model: "PlainPost", foreignKey: "authorId" },
      },
    });
    await User.init();

    db.model({
      name: "PlainPost",
      collection: "plain_posts",
      schema: {
        title: { type: "string", required: true },
        authorId: { type: "string", required: true },
      },
    });

    await User.create({ name: "NoInclude" });
    const users = await User.find();
    expect(users[0]!.posts).toBeUndefined();
  });
});
