import assert from "node:assert/strict";
import test from "node:test";

import { applyOllamaEvent } from "../public/ollama-stream.js";

test("accumulates thinking separately from visible content", () => {
  const message = { role: "assistant", content: "", pending: true };
  assert.equal(
    applyOllamaEvent({ message: { thinking: "先算" } }, message),
    true
  );
  assert.equal(message.thinking, "先算");
  assert.equal(message.content, "");
  assert.equal(message.pending, true);

  applyOllamaEvent({ message: { thinking: "一步" } }, message);
  applyOllamaEvent({ message: { content: "答案是 4" } }, message);

  assert.equal(message.thinking, "先算一步");
  assert.equal(message.content, "答案是 4");
  assert.equal(message.pending, false);
});

test("ignores empty transport chunks and keeps generate-style response", () => {
  const message = { role: "assistant", content: "", pending: true };
  assert.equal(applyOllamaEvent({ message: { content: "" } }, message), false);
  applyOllamaEvent({ response: "hi", thinking: "why" }, message);
  assert.equal(message.thinking, "why");
  assert.equal(message.content, "hi");
});
