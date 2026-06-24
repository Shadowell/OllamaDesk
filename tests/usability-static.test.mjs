import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const [html, appJs, css] = await Promise.all([
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/styles.css", import.meta.url), "utf8")
]);

test("mobile layout collapses to one usable column after the compact overrides", () => {
  const mobileBlocks = Array.from(css.matchAll(/@media\s*\(max-width:\s*820px\)\s*{([\s\S]*?)\n}/g));
  assert.ok(mobileBlocks.length > 0, "expected mobile media query");

  const finalMobileBlock = mobileBlocks.at(-1)[1];
  assert.match(finalMobileBlock, /\.app-shell\s*{[\s\S]*grid-template-columns:\s*1fr;/);
  assert.match(finalMobileBlock, /\.main-panel\s*{[\s\S]*width:\s*100%;/);
});

test("core controls expose usable Chinese labels and mobile access", () => {
  assert.match(html, /id="mobileMenuButton"/);
  assert.match(html, /aria-label="打开侧栏"/);
  assert.match(html, /aria-label="清空当前对话"/);
  assert.match(html, /aria-label="上传图片"/);
  assert.match(html, /aria-label="发送消息"/);
  assert.match(html, /aria-label="选择模型"/);

  assert.doesNotMatch(html, /New conversation|Connecting|Attach image|Send|Clear/);
  assert.doesNotMatch(appJs, /New conversation|You|Unknown error|Generated image|Remove image/);
});

test("composer shows the selected model in one place only", () => {
  assert.equal((html.match(/id="modelSelect"/g) || []).length, 1);
  assert.doesNotMatch(html, /id="statusDetail"/);
  assert.doesNotMatch(html, /class="status-mini"/);
  assert.doesNotMatch(appJs, /statusDetail/);
  assert.doesNotMatch(css, /\.status-mini/);
});

test("settings panel opens from the sidebar side", () => {
  const settingsPanelBlock = css.match(/\.settings-panel\s*{[\s\S]*?\n}/)?.[0] || "";
  const settingsCardBlock = css.match(/\.settings-card\s*{[\s\S]*?\n}/)?.[0] || "";

  assert.match(settingsPanelBlock, /justify-content:\s*flex-start;/);
  assert.match(settingsCardBlock, /border-right:/);
  assert.match(settingsCardBlock, /box-shadow:\s*18px 0 60px/);
  assert.doesNotMatch(settingsPanelBlock, /justify-content:\s*flex-end;/);
  assert.doesNotMatch(settingsCardBlock, /border-left:/);
});

test("removed image generation workflow is not exposed as an unavailable control", () => {
  assert.doesNotMatch(html, /图片生成|图片理解/);
  assert.doesNotMatch(html, /id="composerNotice"|id="imageSetupHelp"/);
  assert.doesNotMatch(appJs, /showComposerNotice|OPENAI_API_KEY|prepareImageGenerationPrompt/);
});
