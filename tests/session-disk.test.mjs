import assert from "node:assert/strict";
import { mkdtemp, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { isSafeSessionId, readSessionStore, writeSessionStore } from "../session-disk.js";

test("rejects path-like session ids", () => {
  assert.equal(isSafeSessionId("../etc"), false);
  assert.equal(isSafeSessionId("a/b"), false);
  assert.equal(isSafeSessionId("session-12345678"), true);
});

test("writes, lists, and deletes session files on disk", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ollama-desk-"));
  await writeSessionStore(root, {
    sessions: [
      { id: "session-aaaaaaaa", title: "旧", updatedAt: 1, messages: [] },
      { id: "session-bbbbbbbb", title: "新", updatedAt: 3, messages: [{ role: "user", content: "hi" }] }
    ]
  });

  const first = await readSessionStore(root);
  assert.equal(first.sessions[0].id, "session-bbbbbbbb");
  assert.equal(first.sessions.length, 2);

  await writeSessionStore(root, {
    sessions: [{ id: "session-bbbbbbbb", title: "新", updatedAt: 4, messages: [] }]
  });

  const second = await readSessionStore(root);
  assert.deepEqual(
    second.sessions.map((session) => session.id),
    ["session-bbbbbbbb"]
  );
  const files = await readdir(path.join(root, "sessions"));
  assert.deepEqual(files, ["session-bbbbbbbb.json"]);
});
