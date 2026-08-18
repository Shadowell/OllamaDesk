export const MAX_ATTACHMENTS = 4;
export const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGE_EDGE = 1280;
export const SKIP_COMPRESS_BYTES = 400 * 1024;
export const JPEG_QUALITY = 0.82;

export function filterImageFiles(files = [], currentCount = 0) {
  const remaining = Math.max(0, MAX_ATTACHMENTS - currentCount);
  return Array.from(files)
    .filter((file) => file?.type?.startsWith("image/") && file.size <= MAX_SOURCE_BYTES)
    .slice(0, remaining);
}

export function dataUrlToAttachment(file, dataUrl, type = file?.type || "image/jpeg") {
  return {
    id: globalThis.crypto?.randomUUID?.() || `img-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: file?.name || "image",
    type,
    preview: dataUrl,
    base64: String(dataUrl).split(",")[1] || ""
  };
}

export async function prepareImageFile(file, readAsDataUrl) {
  const compressed = await compressImageFile(file, readAsDataUrl);
  return dataUrlToAttachment(file, compressed.dataUrl, compressed.type);
}

export async function compressImageFile(file, readAsDataUrl) {
  if (file.size <= SKIP_COMPRESS_BYTES || typeof createImageBitmap !== "function") {
    return {
      dataUrl: await readAsDataUrl(file),
      type: file.type || "image/png"
    };
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  return {
    dataUrl: canvas.toDataURL("image/jpeg", JPEG_QUALITY),
    type: "image/jpeg"
  };
}
