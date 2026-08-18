import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3217);
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const maxBodyBytes = 2 * 1024 * 1024;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        reject(new Error("Request body is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const body = Buffer.concat(chunks).toString("utf8") || "{}";
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

async function proxyOllamaChat(req, res) {
  const abortController = new AbortController();
  const abortFromClient = () => {
    if (!res.writableEnded) abortController.abort();
  };
  req.on("close", abortFromClient);
  res.on("close", abortFromClient);

  try {
    const body = await readJsonBody(req);
    const model = body.model || "gemma4:12b";
    const messages = Array.isArray(body.messages) ? body.messages : [];

    if (!messages.length) {
      sendJson(res, 400, { error: "No messages provided." });
      return;
    }

    const ollamaResponse = await fetch(`${ollamaBaseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: abortController.signal,
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        think: false,
        options: {
          temperature: 0.7
        }
      })
    });

    if (!ollamaResponse.ok || !ollamaResponse.body) {
      const errorText = await ollamaResponse.text().catch(() => "");
      sendJson(res, ollamaResponse.status || 502, {
        error: errorText || `Ollama returned HTTP ${ollamaResponse.status}`
      });
      return;
    }

    res.writeHead(200, {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no"
    });

    await pipeline(Readable.fromWeb(ollamaResponse.body), res);
  } catch (error) {
    if (abortController.signal.aborted) {
      if (!res.headersSent) res.writeHead(499);
      if (!res.writableEnded) res.end();
      return;
    }
    if (!res.headersSent) {
      sendJson(res, 500, { error: error.message || "Chat request failed." });
    } else if (!res.writableEnded) {
      res.end();
    }
  } finally {
    req.off("close", abortFromClient);
    res.off("close", abortFromClient);
  }
}

async function getStatus(res) {
  try {
    const [versionResponse, tagsResponse] = await Promise.all([
      fetch(`${ollamaBaseUrl}/api/version`),
      fetch(`${ollamaBaseUrl}/api/tags`)
    ]);

    const version = versionResponse.ok ? await versionResponse.json() : null;
    const tags = tagsResponse.ok ? await tagsResponse.json() : { models: [] };
    const models = (tags.models || []).map((model) => ({
      name: model.name,
      size: model.size,
      modified_at: model.modified_at
    }));

    sendJson(res, 200, {
      ok: versionResponse.ok,
      ollamaBaseUrl,
      version: version?.version || null,
      markdown: {
        enabled: true
      },
      models
    });
  } catch (error) {
    sendJson(res, 200, {
      ok: false,
      ollamaBaseUrl,
      version: null,
      models: [],
      markdown: {
        enabled: true
      },
      error: error.message || "Unable to reach Ollama."
    });
  }
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const safePath = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  const requestedPath = safePath === "/" ? "/index.html" : safePath;
  const filePath = path.join(publicDir, requestedPath);

  if (!filePath.startsWith(publicDir) || !existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath);
  res.writeHead(200, {
    "Content-Type": mimeTypes[ext] || "application/octet-stream",
    "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=300"
  });
  createReadStream(filePath).pipe(res);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/status") {
    await getStatus(res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/chat") {
    await proxyOllamaChat(req, res);
    return;
  }

  if (req.method === "GET") {
    await serveStatic(req, res);
    return;
  }

  sendJson(res, 405, { error: "Method not allowed." });
});

server.listen(port, host, () => {
  console.log(`OllamaDesk running at http://${host}:${port}`);
  console.log(`Proxying Ollama at ${ollamaBaseUrl}`);
});
