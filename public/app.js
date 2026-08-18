import { filterImageFiles, prepareImageFile } from "./attachments.js";
import { toOllamaMessages } from "./chat-context.js";
import { renderMarkdown, renderStreamingMarkdown } from "./markdown.js";
import {
  applySessionTitle,
  lastAssistantIndex,
  takeEditTarget,
  takeRetryTarget
} from "./session-actions.js";
import {
  loadSessions as readStoredSessions,
  persistSessions,
  readStoredModel,
  writeStoredModel
} from "./session-store.js";

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
  `,
  square: `
    <rect x="7" y="7" width="10" height="10"></rect>
  `,
  copy: `
    <rect x="8" y="8" width="13" height="13" rx="2"></rect>
    <path d="M4 16V4a2 2 0 0 1 2-2h10"></path>
  `,
  pencil: `
    <path d="M12 20h9"></path>
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
  `,
  rotate: `
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
    <path d="M3 3v5h5"></path>
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

let sessions = [];
let activeSessionId = "";
let isSending = false;
let latestStatus = null;
let shouldAutoScrollMessages = true;
let attachments = [];
let activeChatAbort = null;
let pendingStreamMessage = null;
let streamRenderFrame = 0;

boot();

async function boot() {
  sessions = await readStoredSessions();
  activeSessionId = sessions[0]?.id || createSession().id;
  init();
}

function init() {
  renderIcons();
  bindEvents();
  refreshStatus();
  render();
  setInterval(() => {
    if (!document.hidden) refreshStatus();
  }, 15000);
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
  elements.modelSelect.addEventListener("change", () => {
    const session = getActiveSession();
    session.model = elements.modelSelect.value;
    writeStoredModel(session.model);
    saveSessions();
    renderCapabilityStatus(latestStatus);
  });
  elements.attachButton.addEventListener("click", () => elements.fileInput.click());
  elements.fileInput.addEventListener("change", (event) => {
    addFiles(Array.from(event.target.files || []));
    elements.fileInput.value = "";
  });
  elements.dropZone.addEventListener("scroll", () => {
    shouldAutoScrollMessages = isNearConversationBottom();
  });
  elements.activeTitle.addEventListener("dblclick", () => {
    beginActiveTitleRename();
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
    if (isSending) {
      abortActiveChat();
      return;
    }
    if (!elements.settingsPanel.hidden) setSettingsPanelOpen(false);
    setSidebarOpen(false);
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshStatus();
  });
}

function saveSessions() {
  persistSessions(sessions).catch(() => {});
}

function createSession() {
  const session = {
    id: crypto.randomUUID(),
    title: emptySessionTitle,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    model: elements.modelSelect.value || readStoredModel(),
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
    button.title = "双击标题可重命名";
    button.addEventListener("click", () => {
      activeSessionId = session.id;
      attachments = [];
      shouldAutoScrollMessages = true;
      setSidebarOpen(false);
      if (session.model) elements.modelSelect.value = session.model;
      render();
    });
    button.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      beginThreadRename(session, row);
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

function beginThreadRename(session, row) {
  if (row.querySelector(".thread-rename")) return;
  const input = document.createElement("input");
  input.type = "text";
  input.className = "thread-rename";
  input.value = session.title === emptySessionTitle ? "" : session.title;
  input.setAttribute("aria-label", "重命名对话");
  input.addEventListener("click", (event) => event.stopPropagation());
  input.addEventListener("dblclick", (event) => event.stopPropagation());

  let settled = false;
  const commit = (shouldSave) => {
    if (settled) return;
    settled = true;
    if (shouldSave) {
      session.title = applySessionTitle(input.value, emptySessionTitle);
      session.updatedAt = Date.now();
      saveSessions();
    }
    render();
  };

  input.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      commit(true);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      commit(false);
    }
  });
  input.addEventListener("blur", () => commit(true));

  row.classList.add("renaming");
  row.querySelector(".thread-item")?.replaceWith(input);
  input.focus();
  input.select();
}

function beginActiveTitleRename() {
  if (elements.activeTitle.dataset.editing === "true") return;
  const session = getActiveSession();
  const label = elements.activeTitle;
  label.dataset.editing = "true";
  label.contentEditable = "true";
  label.spellcheck = false;
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(label);
  selection.removeAllRanges();
  selection.addRange(range);

  let settled = false;
  const finish = (shouldCommit) => {
    if (settled) return;
    settled = true;
    label.removeEventListener("keydown", onKeyDown);
    label.contentEditable = "false";
    delete label.dataset.editing;
    if (shouldCommit) {
      session.title = applySessionTitle(label.textContent, emptySessionTitle);
      session.updatedAt = Date.now();
      saveSessions();
    }
    render();
  };

  const onKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finish(true);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
    }
  };

  label.addEventListener("keydown", onKeyDown);
  label.addEventListener("blur", () => finish(true), { once: true });
}

function renderMessages() {
  const session = getActiveSession();
  const previousScrollTop = elements.dropZone.scrollTop;
  const shouldScrollToBottom = shouldAutoScrollMessages;
  elements.activeTitle.textContent = session.title;
  elements.messages.innerHTML = "";
  elements.emptyState.classList.toggle("hidden", session.messages.length > 0);

  const retryIndex = lastAssistantIndex(session.messages);
  session.messages.forEach((message, index) => {
    elements.messages.appendChild(createMessageNode(message, index, retryIndex));
  });

  requestAnimationFrame(() => {
    if (shouldScrollToBottom) {
      scrollConversationToBottom();
    } else {
      elements.dropZone.scrollTop = previousScrollTop;
    }
  });
}

function createMessageNode(message, index, retryIndex) {
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
  if (!message.pending) {
    bubble.appendChild(createMessageActions(message, index, retryIndex));
  }

  node.append(avatar, bubble);
  return node;
}

function createMessageActions(message, index, retryIndex) {
  const actions = document.createElement("div");
  actions.className = "message-actions";
  actions.appendChild(createActionButton("copy", "复制", () => copyMessage(message)));

  if (message.role === "user" && !isSending) {
    actions.appendChild(createActionButton("pencil", "编辑并重发", () => editUserMessage(index)));
  }
  if (message.role === "assistant" && index === retryIndex && !isSending) {
    actions.appendChild(createActionButton("rotate", "重试这一轮", () => retryLastTurn()));
  }
  return actions;
}

function createActionButton(icon, label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "message-action";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.appendChild(createIcon(icon));
  button.addEventListener("click", onClick);
  return button;
}

function copyMessage(message) {
  const text = String(message.content || "").trim();
  if (!text || !navigator.clipboard?.writeText) return;
  navigator.clipboard.writeText(text).catch(() => {});
}

function editUserMessage(index) {
  if (isSending) return;
  const session = getActiveSession();
  const target = takeEditTarget(session.messages, index);
  if (!target) return;

  session.messages = target.messages;
  if (
    !session.messages.length &&
    session.title === makeTitle(target.userMessage.content)
  ) {
    session.title = emptySessionTitle;
  }
  elements.promptInput.value = target.userMessage.content || "";
  attachments = (target.userMessage.images || []).map((image) => ({ ...image }));
  shouldAutoScrollMessages = true;
  saveSessions();
  render();
  autoSizeComposer();
  elements.promptInput.focus();
}

function retryLastTurn() {
  if (isSending) return;
  const session = getActiveSession();
  const target = takeRetryTarget(session.messages);
  if (!target) return;
  session.messages = target.messages;
  runAssistantTurn(session);
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
  const imageFiles = filterImageFiles(files, attachments.length);
  if (!imageFiles.length) return;
  const nextAttachments = await Promise.all(
    imageFiles.map(async (file) => {
      try {
        return await prepareImageFile(file, fileToDataUrl);
      } catch {
        const preview = await fileToDataUrl(file);
        return {
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type,
          preview,
          base64: preview.split(",")[1] || ""
        };
      }
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

function abortActiveChat() {
  activeChatAbort?.abort();
}

async function sendMessage() {
  if (isSending) {
    abortActiveChat();
    return;
  }

  const prompt = elements.promptInput.value.trim();
  if (!prompt && !attachments.length) return;

  const session = getActiveSession();
  const imagePayload = attachments.map((attachment) => ({
    id: attachment.id,
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

  session.messages.push(userMessage);
  if (session.title === emptySessionTitle) {
    session.title = makeTitle(userMessage.content);
  }

  elements.promptInput.value = "";
  attachments = [];
  autoSizeComposer();
  await runAssistantTurn(session);
}

async function runAssistantTurn(session) {
  const assistantMessage = {
    role: "assistant",
    content: "",
    pending: true,
    createdAt: Date.now()
  };

  session.messages.push(assistantMessage);
  session.updatedAt = Date.now();
  session.model = elements.modelSelect.value || session.model;
  writeStoredModel(session.model);
  shouldAutoScrollMessages = true;
  saveSessions();
  render();
  setSending(true);

  const controller = new AbortController();
  activeChatAbort = controller;

  try {
    await streamChat(session, assistantMessage, controller.signal);
    if (!assistantMessage.content.trim()) {
      assistantMessage.content = "模型没有返回内容，请稍后重试。";
    }
    assistantMessage.pending = false;
  } catch (error) {
    assistantMessage.pending = false;
    if (error.name === "AbortError") {
      if (!assistantMessage.content.trim()) assistantMessage.content = "已停止生成";
    } else {
      assistantMessage.content = `请求失败：${error.message || "未知错误"}`;
    }
  } finally {
    if (activeChatAbort === controller) activeChatAbort = null;
    if (streamRenderFrame) {
      cancelAnimationFrame(streamRenderFrame);
      streamRenderFrame = 0;
    }
    pendingStreamMessage = null;
    session.updatedAt = Date.now();
    saveSessions();
    setSending(false);
    render();
  }
}

async function streamChat(session, assistantMessage, signal) {
  const messages = toOllamaMessages(session.messages);

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
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
    if (signal?.aborted) {
      await reader.cancel();
      throw new DOMException("Aborted", "AbortError");
    }
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
  pendingStreamMessage = messageOrContent;
  if (streamRenderFrame) return;
  streamRenderFrame = requestAnimationFrame(() => {
    streamRenderFrame = 0;
    const current = pendingStreamMessage;
    const shouldStickToBottom = shouldAutoScrollMessages || isNearConversationBottom();
    const content =
      typeof current === "string"
        ? current
        : current?.pending && !current?.content
          ? "正在思考..."
          : current?.content || "";
    const nodes = elements.messages.querySelectorAll(".message.assistant .message-text");
    const last = nodes[nodes.length - 1];
    if (last) {
      last.classList.toggle("pending", Boolean(current?.pending));
      last.innerHTML = renderStreamingMarkdown(content);
      if (shouldStickToBottom) requestAnimationFrame(() => scrollConversationToBottom());
    }
  });
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
  const session = getActiveSession();
  const selected =
    session.model || elements.modelSelect.value || readStoredModel() || "gemma4:12b";
  const models = status.models?.length ? status.models : [{ name: "gemma4:12b" }];
  const nextNames = models.map((model) => model.name);
  const currentNames = Array.from(elements.modelSelect.options).map((option) => option.value);
  if (nextNames.join("\0") !== currentNames.join("\0")) {
    elements.modelSelect.innerHTML = "";
    models.forEach((model) => {
      const option = document.createElement("option");
      option.value = model.name;
      option.textContent = model.name;
      elements.modelSelect.appendChild(option);
    });
  }
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
  elements.sendButton.disabled = isSending ? false : !hasContent;
  elements.sendButton.classList.toggle("is-stop", isSending);
  elements.sendButton.setAttribute("aria-busy", String(isSending));
  elements.sendButton.setAttribute("aria-label", isSending ? "停止生成" : "发送消息");
  elements.sendButton.title = isSending ? "停止生成" : "发送消息";
  const icon = elements.sendButton.querySelector("[data-icon]");
  if (icon) {
    const name = isSending ? "square" : "send";
    icon.dataset.icon = name;
    if (icons[name]) icon.innerHTML = createIconSvg(icons[name]);
  }
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
