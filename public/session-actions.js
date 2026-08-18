export function applySessionTitle(title, emptyTitle = "新对话") {
  const next = String(title || "").replace(/\s+/g, " ").trim();
  return next.slice(0, 48) || emptyTitle;
}

export function lastAssistantIndex(messages = []) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "assistant") return index;
  }
  return -1;
}

export function takeRetryTarget(messages = []) {
  const next = messages.slice();
  if (next.at(-1)?.role === "assistant") next.pop();
  const userMessage = [...next].reverse().find((message) => message.role === "user");
  if (!userMessage) return null;
  return { messages: next, userMessage };
}

export function takeEditTarget(messages = [], index) {
  if (!Number.isInteger(index) || index < 0 || index >= messages.length) return null;
  const userMessage = messages[index];
  if (userMessage.role !== "user") return null;
  return {
    messages: messages.slice(0, index),
    userMessage
  };
}
