export const MAX_CONTEXT_MESSAGES = 24;
export const MAX_IMAGE_TURNS = 2;

export function toOllamaMessages(messages = [], options = {}) {
  const maxMessages = options.maxMessages ?? MAX_CONTEXT_MESSAGES;
  const maxImageTurns = options.maxImageTurns ?? MAX_IMAGE_TURNS;

  const eligible = messages.filter((message) => {
    if (message.role !== "user" && message.role !== "assistant") return false;
    if (message.pending && !String(message.content || "").trim()) return false;
    return true;
  });

  const windowed = eligible.slice(-maxMessages);
  let remainingImageTurns = maxImageTurns;
  const mappedMessages = [];

  for (let index = windowed.length - 1; index >= 0; index -= 1) {
    const message = windowed[index];
    const mapped = {
      role: message.role,
      content: message.content || ""
    };

    if (message.role === "user" && message.images?.length && remainingImageTurns > 0) {
      mapped.images = message.images
        .map((image) => (typeof image === "string" ? image : image.base64))
        .filter(Boolean);
      remainingImageTurns -= 1;
    }

    mappedMessages.unshift(mapped);
  }

  return mappedMessages;
}
