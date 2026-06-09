import assert from "node:assert/strict";
import test from "node:test";

import { renderMarkdown } from "../public/markdown.js";

test("renders common assistant markdown safely", () => {
  const html = renderMarkdown(
    [
      "目前我**无法直接生成视频文件**。",
      "",
      "我的功能主要集中在：",
      "1. **文字创作**：写故事、写代码。",
      "2. **图像分析**：描述图片。",
      "",
      "```js",
      "console.log('<safe>');",
      "```"
    ].join("\n")
  );

  assert.match(html, /<strong>无法直接生成视频文件<\/strong>/);
  assert.match(html, /<ol>/);
  assert.match(html, /<li><strong>文字创作<\/strong>：写故事、写代码。<\/li>/);
  assert.match(html, /<pre><code class="language-js">console\.log\(&#39;&lt;safe&gt;&#39;\);<\/code><\/pre>/);
  assert.doesNotMatch(html, /<safe>/);
});

test("renders markdown headings without leaking hash markers", () => {
  const html = renderMarkdown(
    [
      "### 1. 对”原生链上（On-chain）”体验的追求",
      "",
      "正文内容"
    ].join("\n")
  );

  assert.match(html, /<h3>1\. 对”原生链上（On-chain）”体验的追求<\/h3>/);
  assert.match(html, /<p>正文内容<\/p>/);
  assert.doesNotMatch(html, /###/);
});
