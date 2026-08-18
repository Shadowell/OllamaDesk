const blockTags = new Set(["p", "ol", "ul", "pre", "h1", "h2", "h3", "h4", "h5", "h6"]);

export function hasUnclosedFence(markdown = "") {
  let open = false;
  for (const line of String(markdown).replace(/\r\n/g, "\n").split("\n")) {
    if (/^```([a-zA-Z0-9_-]*)\s*$/.test(line)) open = !open;
  }
  return open;
}

export function renderStreamingMarkdown(markdown = "") {
  const text = String(markdown);
  if (!hasUnclosedFence(text)) return renderMarkdown(text);

  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let lastOpen = -1;
  let open = false;
  for (let index = 0; index < lines.length; index += 1) {
    if (/^```([a-zA-Z0-9_-]*)\s*$/.test(lines[index])) {
      open = !open;
      if (open) lastOpen = index;
    }
  }
  if (lastOpen < 0) return renderMarkdown(text);

  const closed = lines.slice(0, lastOpen).join("\n");
  const openBody = lines.slice(lastOpen + 1).join("\n");
  const prefix = closed.trim() ? renderMarkdown(closed) : "";
  return `${prefix}<pre><code>${escapeHtml(openBody)}</code></pre>`;
}

export function renderMarkdown(markdown = "") {
  const lines = String(markdown).replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];
  let list = null;
  let codeFence = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${renderInline(paragraph.join("\n"))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    blocks.push(`<${list.type}>${list.items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</${list.type}>`);
    list = null;
  };

  for (const rawLine of lines) {
    const line = rawLine;
    const fenceMatch = line.match(/^```([a-zA-Z0-9_-]*)\s*$/);

    if (codeFence) {
      if (fenceMatch) {
        const languageClass = codeFence.language ? ` class="language-${escapeAttribute(codeFence.language)}"` : "";
        blocks.push(`<pre><code${languageClass}>${escapeHtml(codeFence.lines.join("\n"))}</code></pre>`);
        codeFence = null;
      } else {
        codeFence.lines.push(line);
      }
      continue;
    }

    if (fenceMatch) {
      flushParagraph();
      flushList();
      codeFence = {
        language: fenceMatch[1] || "",
        lines: []
      };
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${renderInline(headingMatch[2].trim())}</h${level}>`);
      continue;
    }

    const orderedMatch = line.match(/^\s*\d+[.)]\s+(.+)$/);
    const unorderedMatch = line.match(/^\s*[-*+]\s+(.+)$/);

    if (orderedMatch || unorderedMatch) {
      flushParagraph();
      const type = orderedMatch ? "ol" : "ul";
      const item = orderedMatch?.[1] ?? unorderedMatch?.[1] ?? "";
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push(item);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  if (codeFence) {
    const languageClass = codeFence.language ? ` class="language-${escapeAttribute(codeFence.language)}"` : "";
    blocks.push(`<pre><code${languageClass}>${escapeHtml(codeFence.lines.join("\n"))}</code></pre>`);
  }
  flushParagraph();
  flushList();

  return blocks.filter((block) => blockTags.has(block.match(/^<([a-z][a-z0-9]*)/)?.[1] || "")).join("");
}

function renderInline(input) {
  const tokens = [];
  let text = String(input).replace(/`([^`\n]+)`/g, (_, code) => {
    const token = `@@CODE_${tokens.length}@@`;
    tokens.push(`<code>${escapeHtml(code)}</code>`);
    return token;
  });

  text = escapeHtml(text);
  text = text.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  text = text.replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, label, href) => {
    return `<a href="${escapeAttribute(href)}" target="_blank" rel="noreferrer">${label}</a>`;
  });
  text = text.replace(/\n/g, "<br>");

  tokens.forEach((value, index) => {
    text = text.replace(`@@CODE_${index}@@`, value);
  });

  return text;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
