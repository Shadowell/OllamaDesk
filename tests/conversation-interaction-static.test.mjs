import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const [html, appJs, css] = await Promise.all([
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/styles.css", import.meta.url), "utf8")
]);

test("conversation roles are visually anchored to opposite sides", () => {
  assert.match(appJs, /node\.className = `message \$\{message\.role\} message-\$\{message\.role\}`;/);
  assert.match(appJs, /message\.role === "user" \? "我" : "Agent"/);
  assert.match(appJs, /node\.setAttribute\("aria-label", `\$\{roleLabel\}消息`\)/);

  assert.match(css, /\.message\.assistant\s*{[\s\S]*justify-content:\s*flex-start;/);
  assert.match(css, /\.message\.user\s*{[\s\S]*justify-content:\s*flex-end;/);
  assert.match(css, /\.message\.user \.avatar\s*{[\s\S]*order:\s*2;/);
  assert.match(css, /\.message\.user \.bubble\s*{[\s\S]*order:\s*1;/);
});

test("history items expose a separate delete action", () => {
  assert.match(html, /aria-label="历史对话列表"/);
  assert.match(appJs, /function deleteSession\(sessionId\)/);
  assert.match(appJs, /deleteButton\.className = "thread-delete"/);
  assert.match(appJs, /删除对话：/);
  assert.match(appJs, /event\.stopPropagation\(\)/);
  assert.match(css, /\.thread-row\s*{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) 32px;/);
  assert.match(css, /\.thread-delete\s*{/);
});

test("messages expose copy, edit, and retry actions", () => {
  assert.match(appJs, /function retryLastTurn\(/);
  assert.match(appJs, /function editUserMessage\(/);
  assert.match(appJs, /function beginThreadRename\(/);
  assert.match(appJs, /function beginActiveTitleRename\(/);
  assert.match(appJs, /takeRetryTarget/);
  assert.match(appJs, /takeEditTarget/);
  assert.match(appJs, /applySessionTitle/);
  assert.match(appJs, /编辑并重发/);
  assert.match(appJs, /重试这一轮/);
  assert.match(css, /\.message-actions\s*{/);
  assert.match(css, /\.thread-rename\s*{/);
});

test("deleting the active history selects another conversation or creates one", () => {
  const deleteBody =
    appJs.match(/function deleteSession\(sessionId\)[\s\S]*?\n}\n\nfunction setSending/)?.[0] || "";

  assert.match(deleteBody, /sessions\.splice\(sessionIndex, 1\)/);
  assert.match(deleteBody, /sessionId === activeSessionId/);
  assert.match(deleteBody, /sessions\[sessionIndex\]\?\.id/);
  assert.match(deleteBody, /createSession\(\)\.id/);
  assert.match(deleteBody, /renderCapabilityStatus\(latestStatus\)/);
});
