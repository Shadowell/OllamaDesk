import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const appJs = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

test("streaming output respects manual scroll position", () => {
  assert.match(appJs, /let shouldAutoScrollMessages = true;/);
  assert.match(appJs, /addEventListener\("scroll"/);
  assert.match(appJs, /function isNearConversationBottom\(/);
  assert.match(appJs, /function scrollConversationToBottom\(/);

  const updateBody = appJs.match(/function updateLastAssistantNode[\s\S]*?\n}\n\nasync function refreshStatus/)?.[0] || "";
  assert.match(updateBody, /shouldStickToBottom/);
  assert.match(updateBody, /isNearConversationBottom\(\)/);
  assert.match(updateBody, /scrollConversationToBottom\(\)/);
  assert.doesNotMatch(updateBody, /elements\.dropZone\.scrollTop\s*=\s*elements\.dropZone\.scrollHeight/);
});

test("full message rerender preserves scroll when auto-scroll is disabled", () => {
  const renderBody = appJs.match(/function renderMessages\(\)[\s\S]*?\n}\n\nfunction createMessageNode/)?.[0] || "";
  assert.match(renderBody, /previousScrollTop/);
  assert.match(renderBody, /shouldScrollToBottom/);
  assert.match(renderBody, /scrollConversationToBottom\(\)/);
  assert.match(renderBody, /elements\.dropZone\.scrollTop = previousScrollTop/);
});
