import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const [html, appJs, serverJs, publicFiles] = await Promise.all([
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../server.js", import.meta.url), "utf8"),
  readdir(new URL("../public", import.meta.url))
]);

test("sidebar removes unused search, image, generation, and capability entries", () => {
  for (const removed of [
    "searchInput",
    "imageUploadNavButton",
    "imageGenerateNavButton",
    "ollamaCapability",
    "visionCapability",
    "imageCapability",
    "markdownCapability"
  ]) {
    assert.doesNotMatch(html, new RegExp(`id="${removed}"`));
  }

  assert.doesNotMatch(html, />搜索</);
  assert.doesNotMatch(html, />上传图片</);
  assert.doesNotMatch(html, />图片生成</);
  assert.doesNotMatch(html, />能力</);
  assert.doesNotMatch(html, />图片理解</);
});

test("composer no longer exposes image attachment controls", () => {
  for (const removed of ["attachButton", "fileInput", "attachmentTray", "imagePanel"]) {
    assert.doesNotMatch(html, new RegExp(`id="${removed}"`));
  }
});

test("app javascript no longer wires removed feature controls", () => {
  for (const removed of [
    "extractToolAction",
    "imageUploadNavButton",
    "imageGenerateNavButton",
    "attachButton",
    "fileInput",
    "attachmentTray",
    "imagePanel",
    "ollamaCapability",
    "visionCapability",
    "imageCapability",
    "markdownCapability",
    "prepareImageGenerationPrompt",
    "createImageGrid",
    "generatedImages",
    "/api/images/generate"
  ]) {
    assert.doesNotMatch(appJs, new RegExp(removed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("server no longer exposes image generation status or api routes", () => {
  for (const removed of [
    "/api/images/generate",
    "generateImage",
    "imageGeneration",
    "hasOpenAIKey",
    "OPENAI_IMAGE",
    "OPENAI_API_KEY"
  ]) {
    assert.doesNotMatch(serverJs, new RegExp(removed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.ok(!publicFiles.includes("actions.js"));
});
