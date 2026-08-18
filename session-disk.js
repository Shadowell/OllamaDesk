import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const SESSION_ID = /^[a-zA-Z0-9-]{8,80}$/;

export function isSafeSessionId(id) {
  return typeof id === "string" && SESSION_ID.test(id);
}

export function sessionsDir(rootDir) {
  return path.join(rootDir, "sessions");
}

export async function writeSessionStore(rootDir, payload = {}) {
  const dir = sessionsDir(rootDir);
  await mkdir(dir, { recursive: true });
  const incoming = Array.isArray(payload.sessions) ? payload.sessions.slice(0, 30) : [];
  const keep = new Set();

  for (const session of incoming) {
    if (!isSafeSessionId(session?.id)) continue;
    keep.add(session.id);
    await writeFile(path.join(dir, `${session.id}.json`), JSON.stringify(session), "utf8");
  }

  const existing = await readdir(dir);
  await Promise.all(
    existing.map(async (name) => {
      if (!name.endsWith(".json")) return;
      const id = name.slice(0, -5);
      if (keep.has(id)) return;
      await rm(path.join(dir, name), { force: true });
    })
  );

  return { count: keep.size };
}

export async function readSessionStore(rootDir) {
  const dir = sessionsDir(rootDir);
  let names = [];
  try {
    names = await readdir(dir);
  } catch (error) {
    if (error?.code === "ENOENT") return { sessions: [] };
    throw error;
  }

  const sessions = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const id = name.slice(0, -5);
    if (!isSafeSessionId(id)) continue;
    try {
      const parsed = JSON.parse(await readFile(path.join(dir, name), "utf8"));
      if (parsed?.id === id) sessions.push(parsed);
    } catch {
      // Skip a corrupt file so one bad session does not block the rest.
    }
  }

  sessions.sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0));
  return { sessions };
}
