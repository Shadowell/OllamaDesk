import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const serverJs = await readFile(new URL("../server.js", import.meta.url), "utf8");

test("chat proxy aborts upstream Ollama when the browser disconnects", () => {
  assert.match(serverJs, /new AbortController\(\)/);
  assert.match(serverJs, /abortController\.signal/);
  assert.match(serverJs, /req\.on\("close"/);
  assert.match(serverJs, /pipeline\(Readable\.fromWeb\(ollamaResponse\.body\), res\)/);
  assert.match(serverJs, /think: body\.think === true/);
  assert.match(serverJs, /url\.pathname === "\/api\/sessions"/);
  assert.match(serverJs, /writeSessionStore/);
  assert.match(serverJs, /readSessionStore/);
});
