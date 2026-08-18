import assert from "node:assert/strict";
import test from "node:test";

import {
  applySessionTitle,
  lastAssistantIndex,
  takeEditTarget,
  takeRetryTarget
} from "../public/session-actions.js";

test("retry drops the last assistant and keeps the preceding user turn", () => {
  const target = takeRetryTarget([
    { role: "user", content: "一" },
    { role: "assistant", content: "答一" },
    { role: "user", content: "二" },
    { role: "assistant", content: "已停止生成" }
  ]);

  assert.equal(target.userMessage.content, "二");
  assert.equal(target.messages.length, 3);
  assert.equal(target.messages.at(-1).role, "user");
  assert.equal(takeRetryTarget([{ role: "assistant", content: "孤" }]), null);
});

test("edit removes the chosen user message and everything after it", () => {
  const messages = [
    { role: "user", content: "一" },
    { role: "assistant", content: "答一" },
    { role: "user", content: "二" },
    { role: "assistant", content: "答二" }
  ];

  const target = takeEditTarget(messages, 2);
  assert.equal(target.userMessage.content, "二");
  assert.deepEqual(
    target.messages.map((message) => message.content),
    ["一", "答一"]
  );
  assert.equal(takeEditTarget(messages, 1), null);
});

test("rename trims, caps, and falls back to the empty title", () => {
  assert.equal(applySessionTitle("  本地模型  "), "本地模型");
  assert.equal(applySessionTitle("   "), "新对话");
  assert.equal(applySessionTitle("x".repeat(60)).length, 48);
  assert.equal(lastAssistantIndex([{ role: "user" }, { role: "assistant" }, { role: "user" }]), 1);
});
