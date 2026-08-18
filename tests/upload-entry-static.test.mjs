import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const [html, appJs, css, chatContext] = await Promise.all([
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../public/chat-context.js", import.meta.url), "utf8")
]);

test("composer exposes a usable image upload entry", () => {
  assert.match(html, /id="attachButton"/);
  assert.match(html, /id="fileInput"/);
  assert.match(html, /id="attachmentTray"/);
  assert.match(html, /aria-label="上传图片"/);
  assert.match(html, /data-icon="paperclip"/);
});

test("uploaded images are previewed, removable, and sent to Ollama chat", () => {
  for (const required of [
    "let attachments = []",
    "addFiles",
    "fileToDataUrl",
    "renderAttachments",
    "createImageGrid",
    "imagePayload",
    "toOllamaMessages"
  ]) {
    assert.match(appJs, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(chatContext, /mapped\.images/);

  assert.match(css, /\.attachment-tray\s*{/);
  assert.match(css, /\.attachment-thumb\s*{/);
  assert.match(css, /\.message-images\s*{/);
});
