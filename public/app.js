import { renderMarkdown } from "./markdown.js";

const storageKey = "ollama-desk:sessions:v1";
const emptySessionTitle = "新对话";
const icons = {
  "message-plus": `
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h10"></path>
    <path d="M16 3h6"></path>
    <path d="M19 0v6"></path>
  `,
  settings: `
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  `,
  menu: `
    <path d="M4 6h16"></path>
    <path d="M4 12h16"></path>
    <path d="M4 18h16"></path>
  `,
  trash: `
    <path d="M3 6h18"></path>
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <path d="M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
    <path d="M10 11v6"></path>
    <path d="M14 11v6"></path>
  `,
  paperclip: `
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
  `,
  send: `
    <path d="m22 2-7 20-4-9-9-4Z"></path>
    <path d="M22 2 11 13"></path>
  `,
  x: `
    <path d="M18 6 6 18"></path>
    <path d="m6 6 12 12"></path>
  `
};

const elements = {
  threadList: document.querySelector("#threadList"),
  threadCount: document.querySelector("#threadCount"),
  sidebar: document.querySelector("#sidebar"),
  sidebarBackdrop: document.querySelector("#sidebarBackdrop"),
  mobileMenuButton: document.querySelector("#mobileMenuButton"),
  newChatButton: document.querySelector("#newChatButton"),
  activeTitle: document.querySelector("#activeTitle"),
  connectionLabel: document.querySelector("#connectionLabel"),
  modelSelect: document.querySelector("#modelSelect"),
  clearButton: document.querySelector("#clearButton"),
  dropZone: document.querySelector("#dropZone"),
  emptyState: document.querySelector("#emptyState"),
  messages: document.querySelector("#messages"),
  composer: document.querySelector("#composer"),
  promptInput: document.querySelector("#promptInput"),
  attachButton: document.querySelector("#attachButton"),
  fileInput: document.querySelector("#fileInput"),
  attachmentTray: document.querySelector("#attachmentTray"),
  sendButton: document.querySelector("#sendButton"),
  statusDot: document.querySelector("#statusDot"),
  statusText: document.querySelector("#statusText"),
  settingsButton: document.querySelector("#settingsButton"),
  settingsPanel: document.querySelector("#settingsPanel"),
  settingsCloseButton: document.querySelector("#settingsCloseButton"),
  settingsOllamaStatus: document.querySelector("#settingsOllamaStatus"),
  settingsModelStatus: document.querySelector("#settingsModelStatus"),
  settingsMarkdownStatus: document.querySelector("#settingsMarkdownStatus"),
  settingsStorageStatus: document.querySelector("#settingsStorageStatus")
};

let sessions = loadSessions();
let activeSessionId = sessions[0]?.id || createSession().id;
let isSending = false;
let latestStatus = null;
let shouldAutoScrollMessages = true;
let attachments = [];

init();

function init() {
  renderIcons();
  bindEvents();
  refreshStatus();
  render();
  setInterval(refreshStatus, 15000);
}

function renderIcons() {
  document.querySelectorAll("[data-icon]").forEach((node) => {
    const icon = icons[node.dataset.icon];
    if (!icon) return;
    node.innerHTML = createIconSvg(icon);
  });
}

function createIconSvg(paths) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;
}

function createIcon(name) {
  const node = document.createElement("span");
  node.className = "icon";
  node.dataset.icon = name;
  node.setAttribute("aria-hidden", "true");
  if (icons[name]) node.innerHTML = createIconSvg(icons[name]);
  return node;
}

function bindEvents() {
  elements.newChatButton.addEventListener("click", () => {
    startNewSession();
  });

  elements.mobileMenuButton?.addEventListener("click", () => setSidebarOpen(true));
  elements.sidebarBackdrop?.addEventListener("click", () => setSidebarOpen(false));
  elements.settingsButton?.addEventListener("click", () => setSettingsPanelOpen(true));
  elements.settingsCloseButton?.addEventListener("click", () => setSettingsPanelOpen(false));
  elements.settingsPanel?.addEventListener("click", (event) => {
    if (event.target === elements.settingsPanel) setSettingsPanelOpen(false);
  });
  elements.clearButton.addEventListener("click", clearActiveSession);
  elements.modelSelect.addEventListener("change", () => renderCapabilityStatus(latestStatus));
  elements.attachButton.addEventListener("click", () => elements.fileInput.click());
  elements.fileInput.addEventListener("change", (event) => {
    addFiles(Array.from(event.target.files || []));
    elements.fileInput.value = "";
  });
  elements.dropZone.addEventListener("scroll", () => {
    shouldAutoScrollMessages = isNearConversationBottom();
  });

  elements.composer.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage();
  });

  elements.promptInput.addEventListener("input", autoSizeComposer);
  elements.promptInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
    if (event.key === "Escape" && !elements.settingsPanel.hidden) {
      setSettingsPanelOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
      event.preventDefault();
      startNewSession();
      return;
    }

    if (event.key !== "Escape") return;
    if (!elements.settingsPanel.hidden) setSettingsPanelOpen(false);
    setSidebarOpen(false);
  });
}

function loadSessions() {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {
    // Ignore malformed local data and start fresh.
  }
  return [];
}

function saveSessions() {
  localStorage.setItem(storageKey, JSON.stringify(sessions.slice(0, 30)));
}

function createSession() {
  const session = {
    id: crypto.randomUUID(),
    title: emptySessionTitle,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: []
  };
  sessions.unshift(session);
  return session;
}

function startNewSession() {
  activeSessionId = createSession().id;
  attachments = [];
  shouldAutoScrollMessages = true;
  setSidebarOpen(false);
  saveSessions();
  render();
  elements.promptInput.focus();
}

function getActiveSession() {
  let session = sessions.find((item) => item.id === activeSessionId);
  if (!session) {
    session = createSession();
    activeSessionId = session.id;
  }
  return session;
}

function render() {
  renderThreads();
  renderMessages();
  renderAttachments();
  updateControls();
}

function renderThreads() {
  const visible = sessions;

  elements.threadCount.textContent = String(visible.length);
  elements.threadList.innerHTML = "";
  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty-thread";
    empty.textContent = "暂无对话";
    elements.threadList.appendChild(empty);
    return;
  }

  visible.forEach((session) => {
    const isActive = session.id === activeSessionId;
    const row = document.createElement("div");
    row.className = `thread-row ${isActive ? "active" : ""}`;

    const button = document.createElement("button");
    button.className = "thread-item";
    button.type = "button";
    if (isActive) button.setAttribute("aria-current", "page");
    button.innerHTML = `
      <div class="thread-title"></div>
      <div class="thread-meta">${session.messages.length} 条 · ${formatTime(session.updatedAt)}</div>
    `;
    button.querySelector(".thread-title").textContent = session.title;
    button.addEventListener("click", () => {
      activeSessionId = session.id;
      attachments = [];
      shouldAutoScrollMessages = true;
      setSidebarOpen(false);
      render();
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "thread-delete";
    deleteButton.title = `删除对话：${session.title}`;
    deleteButton.setAttribute("aria-label", `删除对话：${session.title}`);
    deleteButton.disabled = isSending && isActive;
    deleteButton.appendChild(createIcon("trash"));
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteSession(session.id);
    });

    row.append(button, deleteButton);
    elements.threadList.appendChild(row);
  });
}

function renderMessages() {
  const session = getActiveSession();
  const previousScrollTop = elements.dropZone.scrollTop;
  const shouldScrollToBottom = shouldAutoScrollMessages;
  elements.activeTitle.textContent = session.title;
  elements.messages.innerHTML = "";
  elements.emptyState.classList.toggle("hidden", session.messages.length > 0);

  session.messages.forEach((message) => {
    elements.messages.appendChild(createMessageNode(message));
  });

  requestAnimationFrame(() => {
    if (shouldScrollToBottom) {
      scrollConversationToBottom();
    } else {
      elements.dropZone.scrollTop = previousScrollTop;
    }
  });
}

function createMessageNode(message) {
  const node = document.createElement("article");
  const roleLabel = message.role === "user" ? "我" : "Agent";
  node.className = `message ${message.role} message-${message.role}`;
  node.setAttribute("aria-label", `${roleLabel}消息`);

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = message.role === "user" ? "我" : "AI";

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const role = document.createElement("div");
  role.className = "message-role";
  role.textContent = roleLabel;

  const text = document.createElement("div");
  text.className = `message-text ${message.pending ? "pending" : ""}`;
  text.innerHTML = renderMarkdown(message.pending && !message.content ? "正在思考..." : message.content || "");

  bubble.append(role, text);
  if (message.images?.length) {
    bubble.appendChild(createImageGrid(message.images));
  }

  node.append(avatar, bubble);
  return node;
}

function createImageGrid(images, className = "message-images") {
  const grid = document.createElement("div");
  grid.className = className;
  images.forEach((image, index) => {
    const item = document.createElement("img");
    const src = typeof image === "string" ? `data:image/png;base64,${image}` : image.preview;
    item.src = src;
    item.alt = typeof image === "string" ? `图片 ${index + 1}` : image.name || `图片 ${index + 1}`;
    grid.appendChild(item);
  });
  return grid;
}

function renderAttachments() {
  elements.attachmentTray.innerHTML = "";
  elements.attachmentTray.hidden = attachments.length === 0;
  attachments.forEach((attachment, index) => {
    const thumb = document.createElement("div");
    thumb.className = "attachment-thumb";

    const image = document.createElement("img");
    image.src = attachment.preview;
    image.alt = attachment.name || `图片 ${index + 1}`;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-attachment";
    remove.title = "移除图片";
    remove.setAttribute("aria-label", "移除图片");
    remove.appendChild(createIcon("x"));
    remove.addEventListener("click", () => {
      attachments.splice(index, 1);
      renderAttachments();
      updateControls();
      elements.promptInput.focus();
    });

    thumb.append(image, remove);
    elements.attachmentTray.appendChild(thumb);
  });
}

async function addFiles(files) {
  const imageFiles = files.filter((file) => file.type.startsWith("image/"));
  if (!imageFiles.length) return;
  const nextAttachments = await Promise.all(
    imageFiles.map(async (file) => {
      const preview = await fileToDataUrl(file);
      return {
        name: file.name,
        type: file.type,
        preview,
        base64: preview.split(",")[1] || ""
      };
    })
  );
  attachments = attachments.concat(nextAttachments);
  renderAttachments();
  updateControls();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error || new Error("图片读取失败")));
    reader.readAsDataURL(file);
  });
}

async function sendMessage() {
  if (isSending) return;

  const prompt = elements.promptInput.value.trim();
  if (!prompt && !attachments.length) return;

  const session = getActiveSession();
  const imagePayload = attachments.map((attachment) => ({
    name: attachment.name,
    type: attachment.type,
    preview: attachment.preview,
    base64: attachment.base64
  }));
  const userMessage = {
    role: "user",
    content: prompt || "请分析这张图片。",
    images: imagePayload,
    createdAt: Date.now()
  };

  const assistantMessage = {
    role: "assistant",
    content: "",
    pending: true,
    createdAt: Date.now()
  };

  session.messages.push(userMessage, assistantMessage);
  session.updatedAt = Date.now();
  if (session.title === emptySessionTitle) {
    session.title = makeTitle(userMessage.content);
  }

  elements.promptInput.value = "";
  attachments = [];
  shouldAutoScrollMessages = true;
  autoSizeComposer();
  saveSessions();
  render();
  setSending(true);

  try {
    await streamChat(session, assistantMessage);
    if (!assistantMessage.content.trim()) {
      assistantMessage.content = "模型没有返回内容，请稍后重试。";
    }
    assistantMessage.pending = false;
  } catch (error) {
    assistantMessage.pending = false;
    assistantMessage.content = `请求失败：${error.message || "未知错误"}`;
  } finally {
    session.updatedAt = Date.now();
    saveSessions();
    setSending(false);
    render();
  }
}

async function streamChat(session, assistantMessage) {
  const messages = session.messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => {
      const mapped = {
        role: message.role,
        content: message.content || ""
      };
      if (message.role === "user" && message.images?.length) {
        mapped.images = message.images.map((image) => image.base64);
      }
      return mapped;
    });

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: elements.modelSelect.value || "gemma4:12b",
      messages
    })
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      handleOllamaLine(line, assistantMessage);
    }
  }

  if (buffer.trim()) {
    handleOllamaLine(buffer, assistantMessage);
  }
}

function handleOllamaLine(line, assistantMessage) {
  if (!line.trim()) return;
  try {
    const event = JSON.parse(line);
    if (event.error) {
      assistantMessage.pending = false;
      assistantMessage.content += `\n${event.error}`;
    }
    const content = event.message?.content || event.response || "";
    if (content) {
      if (assistantMessage.pending) {
        assistantMessage.content = "";
        assistantMessage.pending = false;
      }
      assistantMessage.content += content;
      updateLastAssistantNode(assistantMessage);
    }
  } catch {
    // Ignore incomplete transport fragments.
  }
}

function isNearConversationBottom(threshold = 96) {
  const distance =
    elements.dropZone.scrollHeight - elements.dropZone.scrollTop - elements.dropZone.clientHeight;
  return distance <= threshold;
}

function scrollConversationToBottom() {
  elements.dropZone.scrollTop = elements.dropZone.scrollHeight;
  shouldAutoScrollMessages = true;
}

function updateLastAssistantNode(messageOrContent) {
  const shouldStickToBottom = shouldAutoScrollMessages || isNearConversationBottom();
  const content =
    typeof messageOrContent === "string"
      ? messageOrContent
      : messageOrContent?.pending && !messageOrContent?.content
        ? "正在思考..."
        : messageOrContent?.content || "";
  const nodes = elements.messages.querySelectorAll(".message.assistant .message-text");
  const last = nodes[nodes.length - 1];
  if (last) {
    last.classList.toggle("pending", Boolean(messageOrContent?.pending));
    last.innerHTML = renderMarkdown(content);
    if (shouldStickToBottom) requestAnimationFrame(() => scrollConversationToBottom());
  }
}

async function refreshStatus() {
  try {
    const response = await fetch("/api/status");
    const status = await response.json();
    latestStatus = status;
    syncModelOptions(status);
    renderCapabilityStatus(status);
  } catch {
    latestStatus = {
      ok: false,
      version: null,
      models: [{ name: "gemma4:12b" }],
      markdown: { enabled: true },
      error: "Ollama is not reachable"
    };
    syncModelOptions(latestStatus);
    renderCapabilityStatus(latestStatus);
  }
}

function syncModelOptions(status) {
  const selected = elements.modelSelect.value || "gemma4:12b";
  const models = status.models?.length ? status.models : [{ name: "gemma4:12b" }];
  elements.modelSelect.innerHTML = "";
  models.forEach((model) => {
    const option = document.createElement("option");
    option.value = model.name;
    option.textContent = model.name;
    elements.modelSelect.appendChild(option);
  });
  elements.modelSelect.value = models.some((model) => model.name === selected)
    ? selected
    : models[0]?.name || "gemma4:12b";
}

function renderCapabilityStatus(status) {
  const safeStatus =
    status || {
      ok: false,
      models: [],
      markdown: { enabled: true }
    };
  const selectedModel = getSelectedModel(safeStatus);
  const selectedName = elements.modelSelect.value || selectedModel?.name || "未选择";
  const markdownReady = safeStatus.markdown?.enabled !== false;

  elements.statusDot.className = `status-dot ${safeStatus.ok ? "ok" : "error"}`;
  elements.statusText.textContent = safeStatus.ok ? "在线" : "离线";
  elements.connectionLabel.textContent = safeStatus.ok ? "Ollama 已连接" : "Ollama 未连接";

  elements.settingsOllamaStatus.textContent = safeStatus.ok
    ? `在线${safeStatus.version ? ` · ${safeStatus.version}` : ""}`
    : safeStatus.error || "无法连接";
  elements.settingsModelStatus.textContent = selectedName;
  elements.settingsMarkdownStatus.textContent = markdownReady ? "已启用" : "未启用";
  elements.settingsStorageStatus.textContent = `浏览器本地 · ${sessions.length} 个会话`;
}

function getSelectedModel(status) {
  const selected = elements.modelSelect.value;
  return status.models?.find((model) => model.name === selected) || status.models?.[0] || null;
}

function setSidebarOpen(isOpen) {
  elements.sidebar.classList.toggle("mobile-open", isOpen);
  elements.sidebarBackdrop.hidden = !isOpen;
  elements.mobileMenuButton.setAttribute("aria-expanded", String(isOpen));
  if (isOpen) elements.newChatButton.focus();
}

function setSettingsPanelOpen(isOpen) {
  elements.settingsPanel.hidden = !isOpen;
  if (isOpen) {
    renderCapabilityStatus(latestStatus);
    setSidebarOpen(false);
    elements.settingsCloseButton.focus();
  } else {
    elements.settingsButton.focus();
  }
}

function clearActiveSession() {
  const session = getActiveSession();
  session.messages = [];
  session.title = emptySessionTitle;
  session.updatedAt = Date.now();
  attachments = [];
  shouldAutoScrollMessages = true;
  saveSessions();
  render();
}

function deleteSession(sessionId) {
  const sessionIndex = sessions.findIndex((item) => item.id === sessionId);
  if (sessionIndex === -1) return;
  if (isSending && sessionId === activeSessionId) return;

  const session = sessions[sessionIndex];
  const confirmed = window.confirm(`删除对话“${session.title}”？这只会清除本机浏览器里的历史。`);
  if (!confirmed) return;

  sessions.splice(sessionIndex, 1);
  if (sessionId === activeSessionId) {
    activeSessionId =
      sessions[sessionIndex]?.id || sessions[sessionIndex - 1]?.id || createSession().id;
    attachments = [];
    shouldAutoScrollMessages = true;
  }

  saveSessions();
  render();
  renderCapabilityStatus(latestStatus);
}

function setSending(value) {
  isSending = value;
  updateControls();
}

function updateControls() {
  const hasContent = elements.promptInput.value.trim() || attachments.length;
  elements.sendButton.disabled = isSending || !hasContent;
  elements.sendButton.setAttribute("aria-busy", String(isSending));
}

function autoSizeComposer() {
  elements.promptInput.style.height = "auto";
  elements.promptInput.style.height = `${Math.min(elements.promptInput.scrollHeight, 180)}px`;
  updateControls();
}

function makeTitle(content) {
  const title = content.replace(/\s+/g, " ").trim();
  return title.length > 28 ? `${title.slice(0, 28)}...` : title || emptySessionTitle;
}

function formatTime(value) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  return date.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit"
  });
}
