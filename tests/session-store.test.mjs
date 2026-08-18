import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPersistedState,
  hasLegacyInlineImages,
  loadSessions,
  persistSessions,
  restoreSessionsFromStored,
  toDurableSessions
} from "../public/session-store.js";

test("persists image bytes separately from session JSON", () => {
  const { stored, images } = buildPersistedState([
    {
      id: "s1",
      title: "配图",
      createdAt: 1,
      updatedAt: 2,
      model: "gemma4:12b",
      messages: [
        {
          role: "user",
          content: "看图",
          createdAt: 1,
          images: [
            {
              id: "img-1",
              name: "cat.png",
              type: "image/png",
              base64: "abc",
              preview: "data:image/png;base64,abc"
            }
          ]
        }
      ]
    }
  ]);

  assert.equal(stored[0].messages[0].images, undefined);
  assert.deepEqual(stored[0].messages[0].imageIds, ["img-1"]);
  assert.equal(images[0].base64, "abc");
  assert.equal(JSON.stringify(stored).includes("abc"), false);
});

test("persists thinking text with the assistant message", () => {
  const { stored } = buildPersistedState([
    {
      id: "s1",
      title: "算",
      think: true,
      messages: [{ role: "assistant", content: "2", thinking: "先加法" }]
    }
  ]);
  assert.equal(stored[0].think, true);
  assert.equal(stored[0].messages[0].thinking, "先加法");
});

test("restores previews from image records and legacy inline payloads", () => {
  const restored = restoreSessionsFromStored(
    [
      {
        id: "s1",
        title: "新对话",
        messages: [{ role: "user", content: "hi", imageIds: ["img-1"] }]
      }
    ],
    [{ id: "img-1", name: "a.png", type: "image/png", base64: "xyz" }]
  );

  assert.equal(restored[0].messages[0].images[0].preview, "data:image/png;base64,xyz");

  const legacy = restoreSessionsFromStored([
    {
      id: "s2",
      title: "旧",
      messages: [
        {
          role: "user",
          content: "old",
          images: [{ name: "b.png", type: "image/jpeg", base64: "old" }]
        }
      ]
    }
  ]);
  assert.equal(legacy[0].messages[0].images[0].preview, "data:image/jpeg;base64,old");
  assert.equal(hasLegacyInlineImages([{ messages: [{ imageIds: ["img-1"] }] }]), false);
  assert.equal(
    hasLegacyInlineImages([
      { messages: [{ images: [{ base64: "old" }] }] }
    ]),
    true
  );
});

test("durable payload embeds images so the disk store is self-contained", () => {
  const durable = toDurableSessions([
    {
      id: "s1",
      title: "图",
      messages: [
        {
          role: "user",
          content: "看",
          images: [{ id: "img-1", name: "a.png", type: "image/png", base64: "abc" }]
        }
      ]
    }
  ]);
  assert.equal(durable[0].messages[0].images[0].base64, "abc");
  assert.equal(durable[0].messages[0].imageIds, undefined);
});

test("loads remote sessions first and migrates a local-only cache", async () => {
  const storage = memoryStorage();
  const remote = [
    { id: "remote-1", title: "远端", messages: [{ role: "user", content: "hi" }] }
  ];
  const loaded = await loadSessions({
    storage,
    download: async () => restoreSessionsFromStored(remote, []),
    upload: async () => {
      throw new Error("should not upload when remote exists");
    }
  });
  assert.equal(loaded[0].title, "远端");

  const uploaded = [];
  storage.setItem(
    "ollama-desk:sessions:v1",
    JSON.stringify([{ id: "local-1", title: "本地", messages: [] }])
  );
  const migrated = await loadSessions({
    storage,
    download: async () => [],
    upload: async (sessions) => {
      uploaded.push(sessions);
    }
  });
  assert.equal(migrated[0].title, "本地");
  assert.equal(uploaded[0][0].id, "local-1");
});

test("persist writes the local cache even if remote upload fails", async () => {
  const storage = memoryStorage();
  await assert.rejects(
    () =>
      persistSessions(
        [{ id: "s1", title: "新对话", messages: [] }],
        {
          storage,
          upload: async () => {
            throw new Error("本机会话保存失败");
          }
        }
      ),
    /本机会话保存失败/
  );
  assert.match(storage.getItem("ollama-desk:sessions:v1"), /s1/);
});

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    }
  };
}
