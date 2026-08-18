import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPersistedState,
  hasLegacyInlineImages,
  restoreSessionsFromStored
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
