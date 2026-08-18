import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const [html, appJs, css] = await Promise.all([
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/styles.css", import.meta.url), "utf8")
]);

test("settings expose a think toggle and stream thinking into a separate part", () => {
  assert.match(html, /id="settingsThinkToggle"/);
  assert.match(html, /思考过程/);
  assert.match(appJs, /function createThinkingBlock\(/);
  assert.match(appJs, /function isThinkEnabled\(/);
  assert.match(appJs, /applyOllamaEvent/);
  assert.match(appJs, /think: isThinkEnabled\(\)/);
  assert.match(css, /\.message-thinking\s*{/);
});
