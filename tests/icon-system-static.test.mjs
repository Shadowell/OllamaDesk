import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const [html, appJs, css] = await Promise.all([
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/styles.css", import.meta.url), "utf8")
]);

test("sidebar and toolbar icons use one data-icon contract instead of mixed glyphs", () => {
  for (const icon of [
    "message-plus",
    "settings",
    "menu",
    "trash",
    "paperclip",
    "send",
    "x"
  ]) {
    assert.match(html, new RegExp(`data-icon="${icon}"`));
  }

  assert.doesNotMatch(html, /[⌕▧✦▤●☰↑]/);
  assert.doesNotMatch(html, /data-icon="search"|data-icon="image-up"|data-icon="sparkles"/);
});

test("app renders inline svg icons from a single map", () => {
  assert.match(appJs, /const icons = {/);
  assert.match(appJs, /function renderIcons\(\)/);
  assert.match(appJs, /querySelectorAll\("\[data-icon\]"\)/);
});

test("icons share stable sizing and optical alignment", () => {
  assert.match(css, /\.icon\s*{[\s\S]*width:\s*18px;[\s\S]*height:\s*18px;/);
  assert.match(css, /\.icon svg\s*{[\s\S]*stroke-width:\s*2;/);
  assert.match(css, /\.composer-icon \.icon\s*{[\s\S]*width:\s*17px;[\s\S]*height:\s*17px;/);
  assert.match(css, /\.send-button \.icon,\n\.top-icon-button \.icon,\n\.mobile-menu-button \.icon,\n\.settings-close \.icon\s*{[\s\S]*width:\s*16px;[\s\S]*height:\s*16px;/);
});
