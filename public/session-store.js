export const SESSION_KEY = "ollama-desk:sessions:v1";
export const MODEL_KEY = "ollama-desk:model";
const IMAGE_DB = "ollama-desk";
const IMAGE_STORE = "images";

export function buildPersistedState(sessions = []) {
  const images = [];
  const stored = sessions.slice(0, 30).map((session) => ({
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    model: session.model || "",
    messages: (session.messages || []).map((message) => {
      const imageIds = [];
      for (const image of message.images || []) {
        const id =
          image.id ||
          globalThis.crypto?.randomUUID?.() ||
          `img-${images.length + 1}`;
        imageIds.push(id);
        images.push({
          id,
          name: image.name || "image",
          type: image.type || "image/jpeg",
          base64: image.base64 || ""
        });
      }
      return {
        role: message.role,
        content: message.content || "",
        createdAt: message.createdAt,
        imageIds: imageIds.length ? imageIds : undefined
      };
    })
  }));
  return { stored, images };
}

export function restoreSessionsFromStored(stored = [], images = []) {
  const imageMap = new Map(images.map((image) => [image.id, image]));
  return stored.map((session) => ({
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    model: session.model || "",
    messages: (session.messages || []).map((message) => {
      const fromIds = (message.imageIds || [])
        .map((id) => withPreview(imageMap.get(id)))
        .filter(Boolean);
      const legacy = (message.images || []).map((image) =>
        withPreview({
          id: image.id || "",
          name: image.name || "image",
          type: image.type || "image/jpeg",
          base64: image.base64 || ""
        })
      );
      const list = fromIds.length ? fromIds : legacy;
      return {
        role: message.role,
        content: message.content || "",
        createdAt: message.createdAt,
        images: list.length ? list : undefined
      };
    })
  }));
}

export function hasLegacyInlineImages(stored = []) {
  return stored.some((session) =>
    (session.messages || []).some((message) => message.images?.some((image) => image.base64))
  );
}

export function readStoredModel(storage = globalThis.localStorage) {
  try {
    return storage?.getItem?.(MODEL_KEY) || "";
  } catch {
    return "";
  }
}

export function writeStoredModel(model, storage = globalThis.localStorage) {
  try {
    if (model) storage?.setItem?.(MODEL_KEY, model);
  } catch {
    // Ignore quota or private-mode failures.
  }
}

export async function loadSessions(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(SESSION_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed) || !parsed.length) return [];
    if (hasLegacyInlineImages(parsed)) {
      return restoreSessionsFromStored(parsed, []);
    }
    const images = globalThis.indexedDB ? await readAllImages() : [];
    return restoreSessionsFromStored(parsed, images);
  } catch {
    return [];
  }
}

export async function persistSessions(sessions, storage = globalThis.localStorage) {
  const { stored, images } = buildPersistedState(sessions);
  if (globalThis.indexedDB) {
    await replaceAllImages(images);
  } else {
    embedImages(stored, images);
  }

  const payload = JSON.stringify(stored);
  try {
    storage?.setItem?.(SESSION_KEY, payload);
  } catch (error) {
    if (error?.name !== "QuotaExceededError") throw error;
    storage?.setItem?.(SESSION_KEY, JSON.stringify(stored.slice(0, 8)));
  }
}

function withPreview(image) {
  if (!image) return null;
  const type = image.type || "image/jpeg";
  return {
    ...image,
    type,
    preview: image.preview || (image.base64 ? `data:${type};base64,${image.base64}` : "")
  };
}

function embedImages(stored, images) {
  const imageMap = new Map(images.map((image) => [image.id, image]));
  stored.forEach((session) => {
    session.messages.forEach((message) => {
      if (!message.imageIds?.length) return;
      message.images = message.imageIds.map((id) => imageMap.get(id)).filter(Boolean);
      delete message.imageIds;
    });
  });
}

function openImageDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IMAGE_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE)) db.createObjectStore(IMAGE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function replaceAllImages(images) {
  const db = await openImageDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, "readwrite");
    const store = tx.objectStore(IMAGE_STORE);
    store.clear();
    images.forEach((image) => store.put(image, image.id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function readAllImages() {
  const db = await openImageDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, "readonly");
    const request = tx.objectStore(IMAGE_STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}
