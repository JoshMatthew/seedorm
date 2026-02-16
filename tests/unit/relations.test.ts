import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { SeedORM } from "../../src/seedorm.js";
import { SeedORMError } from "../../src/errors.js";

let tmpDir: string;
let db: SeedORM;

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seedorm-rel-"));
  db = new SeedORM({ adapter: { adapter: "json", path: tmpDir } });
  await db.connect();
});

afterEach(async () => {
  await db.disconnect();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("Relations — populate", () => {
  it("hasMany: loads related docs as array", async () => {
    const User = db.model({
      name: "User",
      collection: "users",
      schema: { name: { type: "string", required: true } },
      relations: {
        posts: { type: "hasMany", model: "Post", foreignKey: "authorId" },
      },
    });
    await User.init();

    const Post = db.model({
      name: "Post",
      collection: "posts",
      schema: {
        title: { type: "string", required: true },
        authorId: { type: "string", required: true },
      },
    });
    await Post.init();

    const alice = await User.create({ name: "Alice" });
    const bob = await User.create({ name: "Bob" });
    await Post.create({ title: "Post 1", authorId: alice.id });
    await Post.create({ title: "Post 2", authorId: alice.id });
    await Post.create({ title: "Post 3", authorId: bob.id });

    const users = await User.find({ include: ["posts"] });
    const aliceResult = users.find((u) => u.name === "Alice")!;
    const bobResult = users.find((u) => u.name === "Bob")!;

    expect(aliceResult.posts).toHaveLength(2);
    expect(bobResult.posts).toHaveLength(1);
    expect((aliceResult.posts as any[])[0].title).toBeDefined();
  });

  it("hasOne: loads single related doc or null", async () => {
    const User = db.model({
      name: "UserHO",
      collection: "users_ho",
      schema: { name: { type: "string", required: true } },
      relations: {
        profile: { type: "hasOne", model: "ProfileHO", foreignKey: "userId" },
      },
    });
    await User.init();

    const Profile = db.model({
      name: "ProfileHO",
      collection: "profiles_ho",
      schema: {
        bio: { type: "string" },
        userId: { type: "string", required: true },
      },
    });
    await Profile.init();

    const alice = await User.create({ name: "Alice" });
    const bob = await User.create({ name: "Bob" });
    await Profile.create({ bio: "Alice bio", userId: alice.id });

    const users = await User.find({ include: ["profile"] });
    const aliceResult = users.find((u) => u.name === "Alice")!;
    const bobResult = users.find((u) => u.name === "Bob")!;

    expect(aliceResult.profile).toBeTruthy();
    expect((aliceResult.profile as any).bio).toBe("Alice bio");
    expect(bobResult.profile).toBeNull();
  });

  it("belongsTo: loads parent doc", async () => {
    const User = db.model({
      name: "UserBT",
      collection: "users_bt",
      schema: { name: { type: "string", required: true } },
    });
    await User.init();

    const Post = db.model({
      name: "PostBT",
      collection: "posts_bt",
      schema: {
        title: { type: "string", required: true },
        authorId: { type: "string", required: true },
      },
      relations: {
        author: { type: "belongsTo", model: "UserBT", foreignKey: "authorId" },
      },
    });
    await Post.init();

    const alice = await User.create({ name: "Alice" });
    await Post.create({ title: "Post 1", authorId: alice.id });
    await Post.create({ title: "Post 2", authorId: alice.id });

    const posts = await Post.find({ include: ["author"] });
    expect(posts).toHaveLength(2);
    expect((posts[0]!.author as any).name).toBe("Alice");
    expect((posts[1]!.author as any).name).toBe("Alice");
  });

  it("manyToMany: loads related docs through join collection", async () => {
    const PostMM = db.model({
      name: "PostMM",
      collection: "posts_mm",
      schema: { title: { type: "string", required: true } },
      relations: {
        tags: {
          type: "manyToMany",
          model: "TagMM",
          joinCollection: "post_tags_mm",
          foreignKey: "postId",
          relatedKey: "tagId",
        },
      },
    });
    await PostMM.init();

    const Tag = db.model({
      name: "TagMM",
      collection: "tags_mm",
      schema: { label: { type: "string", required: true } },
    });
    await Tag.init();

    // Manually create join collection
    const adapter = db.getAdapter();
    await adapter.createCollection("post_tags_mm", {});

    const post1 = await PostMM.create({ title: "Post 1" });
    const post2 = await PostMM.create({ title: "Post 2" });
    const tagA = await Tag.create({ label: "TypeScript" });
    const tagB = await Tag.create({ label: "JavaScript" });

    await PostMM.associate(post1.id, "tags", tagA.id);
    await PostMM.associate(post1.id, "tags", tagB.id);
    await PostMM.associate(post2.id, "tags", tagA.id);

    const posts = await PostMM.find({ include: ["tags"] });
    const p1 = posts.find((p) => p.title === "Post 1")!;
    const p2 = posts.find((p) => p.title === "Post 2")!;

    expect(p1.tags).toHaveLength(2);
    expect(p2.tags).toHaveLength(1);
    expect((p1.tags as any[]).map((t) => t.label).sort()).toEqual(["JavaScript", "TypeScript"]);
  });
});

describe("Relations — include on findById / findOne", () => {
  it("findById with include populates relations", async () => {
    const User = db.model({
      name: "UserFBI",
      collection: "users_fbi",
      schema: { name: { type: "string", required: true } },
      relations: {
        posts: { type: "hasMany", model: "PostFBI", foreignKey: "authorId" },
      },
    });
    await User.init();

    const Post = db.model({
      name: "PostFBI",
      collection: "posts_fbi",
      schema: {
        title: { type: "string", required: true },
        authorId: { type: "string", required: true },
      },
    });
    await Post.init();

    const alice = await User.create({ name: "Alice" });
    await Post.create({ title: "Hello", authorId: alice.id });

    const found = await User.findById(alice.id, { include: ["posts"] });
    expect(found).toBeTruthy();
    expect(found!.posts).toHaveLength(1);
    expect((found!.posts as any[])[0].title).toBe("Hello");
  });

  it("findOne with include populates relations", async () => {
    const User = db.model({
      name: "UserFO",
      collection: "users_fo",
      schema: { name: { type: "string", required: true } },
      relations: {
        posts: { type: "hasMany", model: "PostFO", foreignKey: "authorId" },
      },
    });
    await User.init();

    const Post = db.model({
      name: "PostFO",
      collection: "posts_fo",
      schema: {
        title: { type: "string", required: true },
        authorId: { type: "string", required: true },
      },
    });
    await Post.init();

    const alice = await User.create({ name: "Alice" });
    await Post.create({ title: "World", authorId: alice.id });

    const found = await User.findOne({ name: "Alice" }, { include: ["posts"] });
    expect(found).toBeTruthy();
    expect(found!.posts).toHaveLength(1);
  });
});

describe("Relations — manyToMany associate/dissociate", () => {
  it("dissociate removes a join row", async () => {
    const PostD = db.model({
      name: "PostD",
      collection: "posts_d",
      schema: { title: { type: "string", required: true } },
      relations: {
        tags: {
          type: "manyToMany",
          model: "TagD",
          joinCollection: "post_tags_d",
          foreignKey: "postId",
          relatedKey: "tagId",
        },
      },
    });
    await PostD.init();

    const TagD = db.model({
      name: "TagD",
      collection: "tags_d",
      schema: { label: { type: "string", required: true } },
    });
    await TagD.init();

    const adapter = db.getAdapter();
    await adapter.createCollection("post_tags_d", {});

    const post = await PostD.create({ title: "Post" });
    const tag = await TagD.create({ label: "TS" });

    await PostD.associate(post.id, "tags", tag.id);
    let found = await PostD.findById(post.id, { include: ["tags"] });
    expect(found!.tags).toHaveLength(1);

    await PostD.dissociate(post.id, "tags", tag.id);
    found = await PostD.findById(post.id, { include: ["tags"] });
    expect(found!.tags).toHaveLength(0);
  });
});

describe("Relations — error handling", () => {
  it("throws on unknown relation name", async () => {
    const User = db.model({
      name: "UserErr",
      collection: "users_err",
      schema: { name: "string" },
    });
    await User.init();

    await User.create({ name: "Test" });
    await expect(User.find({ include: ["nonexistent"] })).rejects.toThrow(SeedORMError);
  });

  it("associate throws for non-manyToMany relation", async () => {
    const User = db.model({
      name: "UserAssocErr",
      collection: "users_ae",
      schema: { name: "string" },
      relations: {
        posts: { type: "hasMany", model: "PostAE", foreignKey: "authorId" },
      },
    });
    await User.init();

    db.model({
      name: "PostAE",
      collection: "posts_ae",
      schema: { title: "string", authorId: "string" },
    });

    await expect(User.associate("id", "posts", "relId")).rejects.toThrow(/manyToMany/);
  });

  it("dissociate throws for non-manyToMany relation", async () => {
    const User = db.model({
      name: "UserDissocErr",
      collection: "users_de",
      schema: { name: "string" },
      relations: {
        posts: { type: "hasMany", model: "PostDE", foreignKey: "authorId" },
      },
    });
    await User.init();

    db.model({
      name: "PostDE",
      collection: "posts_de",
      schema: { title: "string", authorId: "string" },
    });

    await expect(User.dissociate("id", "posts", "relId")).rejects.toThrow(/manyToMany/);
  });
});
