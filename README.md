# OllamaDesk

Codex-like local chat workspace for Ollama models.

## Run

```bash
npm start
```

Open:

```text
http://127.0.0.1:3217
```

## Features

- Local Ollama status and model picker
- Chat sessions saved in browser local storage
- Streaming responses through a local Node proxy
- Markdown rendering for assistant responses
- Mobile-friendly sidebar and composer

## Environment

```bash
PORT=3217 OLLAMA_BASE_URL=http://127.0.0.1:11434 npm start
```

## Checks

```bash
npm test
```
