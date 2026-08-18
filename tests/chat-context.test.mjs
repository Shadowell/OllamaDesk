import assert from "node:assert/strict";
import test from "node:test";

import { toOllamaMessages } from "../public/chat-context.js";

test("drops pending empty assistant and older images beyond the last two turns", () => {
  const messages = [
    { role: "user", content: "first", images: [{ base64: "old-one" }] },
    { role: "assistant", content: "ok" },
    { role: "user", content: "second", images: [{ base64: "old-two" }] },
    { role: "assistant", content: "ok" },
    { role: "user", content: "third", images: [{ base64: "recent-a" }, { base64: "recent-b" }] },
    { role: "assistant", content: "ok" },
    { role: "user", content: "fourth", images: [{ base64: "latest" }] },
    { role: "assistant", content: "", pending: true }
  ];

  const mapped = toOllamaMessages(messages);

  assert.equal(mapped.at(-1).role, "user");
  assert.deepEqual(mapped.at(-1).images, ["latest"]);
  assert.deepEqual(
    mapped.find((message) => message.content === "third").images,
    ["recent-a", "recent-b"]
  );
  assert.equal(mapped.find((message) => message.content === "first").images, undefined);
  assert.equal(mapped.find((message) => message.content === "second").images, undefined);
});

test("forwards assistant thinking into the next Ollama request", () => {
  const mapped = toOllamaMessages([
    { role: "user", content: "1+1" },
    { role: "assistant", content: "2", thinking: "先加法" }
  ]);
  assert.equal(mapped[1].thinking, "先加法");
});

test("keeps only the newest context window", () => {
  const messages = Array.from({ length: 40 }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: `m-${index}`
  }));

  const mapped = toOllamaMessages(messages, { maxMessages: 6 });
  assert.equal(mapped.length, 6);
  assert.equal(mapped[0].content, "m-34");
  assert.equal(mapped.at(-1).content, "m-39");
});
