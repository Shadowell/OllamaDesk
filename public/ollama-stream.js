export function applyOllamaEvent(event, message) {
  if (!event || !message) return false;
  let changed = false;

  if (event.error) {
    message.pending = false;
    message.content = `${message.content || ""}\n${event.error}`;
    changed = true;
  }

  const thinking = event.message?.thinking ?? event.thinking ?? "";
  if (thinking) {
    message.thinking = `${message.thinking || ""}${thinking}`;
    changed = true;
  }

  const content = event.message?.content || event.response || "";
  if (content) {
    if (message.pending) {
      message.content = "";
      message.pending = false;
    }
    message.content = `${message.content || ""}${content}`;
    changed = true;
  }

  return changed;
}
