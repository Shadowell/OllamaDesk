# Qwen3.8-27B 部署手册（智川云 gpu-8 / RTX 4090 24G）

面向这台已经确认过的实例，不写通用空话。目标：在 **单卡 24G** 上把千问 3.8 27B 拉起来，并提供 OpenAI 兼容接口。

## 1. 结论：用 vLLM，不用 SGLang

| 方案 | 这台 4090 24G 上是否可行 | 建议 |
| --- | --- | --- |
| **vLLM + W4A16 / GPTQ Int4（约 18GB）** | 可行。权重能进卡，上下文先从 8K 起 | **主路径** |
| **SGLang + 官方 BF16 / FP8 / NVFP4** | 不可行。官方 cookbook 最低实用档是 5090 32G 的 NVFP4；FP8 权重约 27GB，24G 直接装不下 | 这台卡先别走 |
| **官方 BF16 `Qwen/Qwen3.8-27B`** | 不可行。权重约 52–56GB | 不要下载 |
| **官方 FP8 `Qwen/Qwen3.8-27B-FP8`** | 不可行。权重大约 26–28GB，KV 再一加必 OOM | 不要下载 |
| **Ollama `qwen3.8:27b`（约 18GB）** | 可行。接本仓库 OllamaDesk 最快 | 只想聊天时的备选 |

选 vLLM 而不是 SGLang，不是因为 SGLang 更差，而是因为 **这张卡的显存档位对不上 SGLang 的官方配方**：

- Qwen3.8-27B 是 **稠密 27.8B + 混合注意力（Gated DeltaNet + 全注意力）+ 视觉塔 + MTP**。引擎必须足够新，而且官方高质量权重是 BF16 / FP8 / NVFP4。
- [SGLang 官方 cookbook](https://docs.sglang.io/cookbook/autoregressive/Qwen/Qwen3.8-27B) 的目标卡是 H200、RTX PRO 6000、RTX 5090 32G、DGX Spark。5090 32G 上都写明：BF16 / FP8 **没有可服务的配置**，只剩 NVFP4。4090 24G 比 5090 还少 8G，更不可能走官方精度。
- vLLM 0.17+ 有 Qwen3.8 配方和 hybrid-attention kernel。社区已经有 **约 18.1 GiB 的 W4A16 GPTQ**，专门按 vLLM 打好，24G 单卡能启动。
- 你后面要接本地客户端（OllamaDesk / OpenAI SDK）时，vLLM 的 `/v1/chat/completions` 更直接。

以后如果换到 **48G+**（L40S / A6000 / 6000 Ada）或 **80G**，再改 SGLang + 官方 FP8/BF16，那时 SGLang 的 MTP / 长上下文通常更香。

## 2. 这台机器实测（2026-08-18）

```text
SSH:        ssh root@fj01-ssh.gpuhome.cc -p 30522
主机名:     jupyter-aqqpeiav503ed63j
GPU:        NVIDIA GeForce RTX 4090  24564 MiB  (SM 8.9)
驱动/CUDA:  Driver 580.119.02 / 容器内 CUDA SDK 12.8.1
系统:       Ubuntu 24.04.4，Python 3.12.3，已装 uv / pip
系统盘 /:   30G，几乎空（不要放模型）
数据盘:     /root/rivermind-data  49G，几乎空（模型、venv、缓存都放这里）
内存:       503G，足够
已监听:     8888（Jupyter）、8080
未安装:     vLLM / SGLang / Ollama / Docker
pip 源:     已指向清华 https://pypi.tuna.tsinghua.edu.cn/simple
网络:       ModelScope、清华 PyPI 可通；直连 Hugging Face 可能很慢
```

硬约束只有两个：

1. **显存 24G**：只能跑约 16–18GB 的 4bit 权重，上下文不能一上来开 256K。
2. **数据盘 49G**：只能下一份量化权重。官方 BF16 约 55GB，盘都装不下。

## 3. 精度和显存对照

| 权重 | 体积（大约） | 4090 24G | 数据盘 49G | 说明 |
| --- | --- | --- | --- | --- |
| BF16 官方 | 52–56GB | 否 | 否 | 不要下 |
| FP8 官方 | 26–28GB | 否 | 勉强能下，但卡里跑不了 | 不要下 |
| 部分 AWQ（GDN/视觉塔仍 BF16） | 约 28GB | 否 | 紧张 | 例如部分社区 AWQ，体积看起来不像 4bit |
| **GPTQ / W4A16 真 4bit** | **约 18GB** | **是** | **是** | **本手册主推** |
| Ollama Q4 | 约 18GB | 是 | 是 | 接 OllamaDesk 最省事 |

上下文建议：

- 先 `--max-model-len 8192`
- 稳了再试 `16384` / `32768`
- 不要一上来 `262144`。权重吃掉约 18G 后，只剩大约 6G 给 KV 和激活。

## 4. 主路径：vLLM + W4A16

推荐权重：[`pearsonkyle/Qwen3.8-27B-GPTQ-W4A16`](https://huggingface.co/pearsonkyle/Qwen3.8-27B-GPTQ-W4A16)

- 约 18.1 GiB，compressed-tensors W4A16，vLLM 从 `config.json` 自动识别量化
- 为 vLLM 打的包，带 MTP；tool call 用 Qwen3.8 的 XML 格式
- 不要选把 Gated DeltaNet / 视觉塔留在 BF16、体积涨到 27GB+ 的“4bit”

备选（质量或兼容性出问题时再换）：

- [`palmfuture/Qwen3.8-27B-GPTQ-Int4`](https://huggingface.co/palmfuture/Qwen3.8-27B-GPTQ-Int4)
- 先核对本地下载体积。超过 22GB 就别在这张卡上试。

### 4.1 登录并固定目录

```bash
ssh root@fj01-ssh.gpuhome.cc -p 30522
```

```bash
cat >> ~/.bashrc << 'EOF'
export HF_HOME=/root/rivermind-data/cache/huggingface
export HUGGINGFACE_HUB_CACHE=/root/rivermind-data/cache/huggingface
export MODELSCOPE_CACHE=/root/rivermind-data/cache/modelscope
export UV_CACHE_DIR=/root/rivermind-data/cache/uv
export HF_ENDPOINT=https://hf-mirror.com
export PATH="/root/rivermind-data/venvs/vllm/bin:$PATH"
EOF
source ~/.bashrc

mkdir -p \
  /root/rivermind-data/models \
  /root/rivermind-data/cache/huggingface \
  /root/rivermind-data/cache/modelscope \
  /root/rivermind-data/cache/uv \
  /root/rivermind-data/venvs \
  /root/rivermind-data/logs
```

### 4.2 安装 vLLM

必须装**最新版**。Qwen3.8 的 hybrid attention 需要较新的 vLLM（社区验证口径是 **0.17+**，以你装到的最新稳定版为准）。

```bash
uv venv /root/rivermind-data/venvs/vllm --python 3.12
source /root/rivermind-data/venvs/vllm/bin/activate

uv pip install -U vllm modelscope huggingface_hub
python -c "import vllm; print(vllm.__version__)"
```

如果 `uv pip` 异常，用机器已有的清华源：

```bash
source /root/rivermind-data/venvs/vllm/bin/activate
pip install -U vllm modelscope huggingface_hub
```

### 4.3 下载权重（先镜像，后官方）

优先 Hugging Face 镜像（这份量化目前主要在 HF）：

```bash
source /root/rivermind-data/venvs/vllm/bin/activate

huggingface-cli download pearsonkyle/Qwen3.8-27B-GPTQ-W4A16 \
  --local-dir /root/rivermind-data/models/Qwen3.8-27B-GPTQ-W4A16
```

如果镜像慢或不完整，再试官方源：

```bash
unset HF_ENDPOINT
huggingface-cli download pearsonkyle/Qwen3.8-27B-GPTQ-W4A16 \
  --local-dir /root/rivermind-data/models/Qwen3.8-27B-GPTQ-W4A16
```

下完先看体积，确认不是下成了 50GB+ 的 BF16：

```bash
du -sh /root/rivermind-data/models/Qwen3.8-27B-GPTQ-W4A16
df -h /root/rivermind-data
```

期望大约 **18GB**。超过 24GB 就停，不要启动。

### 4.4 用 tmux 启动服务

容器重启后进程会丢，用 tmux 挂着。

```bash
tmux new -s qwen38
source /root/rivermind-data/venvs/vllm/bin/activate

vllm serve /root/rivermind-data/models/Qwen3.8-27B-GPTQ-W4A16 \
  --host 127.0.0.1 \
  --port 8000 \
  --served-model-name qwen3.8-27b \
  --trust-remote-code \
  --dtype auto \
  --max-model-len 8192 \
  --gpu-memory-utilization 0.90 \
  --kv-cache-dtype fp8 \
  --max-num-seqs 4 \
  --reasoning-parser qwen3 \
  --enable-auto-tool-choice \
  --tool-call-parser qwen3_xml
```

说明：

- **不要**加 `--quantization gptq`，让 vLLM 读 `config.json`。乱指定量化格式容易在 MTP / compressed-tensors 路径上报错。
- `--host 127.0.0.1`：先只本机监听，用 SSH 隧道出去。控制台开放端口后再改 `0.0.0.0`。
- `--tool-call-parser qwen3_xml`：Qwen3.8 默认吐 XML tool call，不是 JSON。不加的话 `tool_calls` 会一直是空。
- 日志出现 `Application startup complete` 或 `Uvicorn running` 再测。

分离 tmux：`Ctrl-b` 再按 `d`。回来：

```bash
tmux attach -t qwen38
```

### 4.5 机器内验收

另开一个 SSH：

```bash
curl -s http://127.0.0.1:8000/v1/models
nvidia-smi
```

```bash
curl http://127.0.0.1:8000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen3.8-27b",
    "messages": [{"role": "user", "content": "用一句话介绍你自己"}],
    "temperature": 1.0,
    "top_p": 0.95,
    "max_tokens": 256
  }'
```

官方采样建议：

- 思考模式（默认）：`temperature=1.0`，`top_p=0.95`，`top_k=20`
- 非思考 / instruct：`temperature=0.7`，`top_p=0.8`，`top_k=20`，`presence_penalty=1.5`

关闭思考（具体字段以你安装的 vLLM 版本文档为准，常见是 extra_body）：

```bash
curl http://127.0.0.1:8000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen3.8-27b",
    "messages": [{"role": "user", "content": "1+1等于几，只回答数字"}],
    "temperature": 0.7,
    "top_p": 0.8,
    "max_tokens": 64,
    "chat_template_kwargs": {"enable_thinking": false}
  }'
```

### 4.6 本地电脑访问

智川云容器默认不把 8000 打到公网。本机另开终端做隧道，保持不关：

```bash
ssh -CNg -L 8000:127.0.0.1:8000 root@fj01-ssh.gpuhome.cc -p 30522
```

然后本机：

```bash
curl -s http://127.0.0.1:8000/v1/models
```

OpenAI SDK：

```python
from openai import OpenAI

client = OpenAI(base_url="http://127.0.0.1:8000/v1", api_key="not-needed")
print(client.chat.completions.create(
    model="qwen3.8-27b",
    messages=[{"role": "user", "content": "你好"}],
).choices[0].message.content)
```

如果要给别人用，到智川云控制台把容器 **8000** 做成开放端口，并把 vLLM 改成 `--host 0.0.0.0`。不要把 root 密码写进任何文件。

## 5. 备选：Ollama（接 OllamaDesk）

本仓库 OllamaDesk 走的是 Ollama 原生 `/api/chat`，**不能直接填 vLLM 的 `/v1`**。只想在 Desk 里聊天，走这条更短。

```bash
curl -fsSL https://ollama.com/install.sh | sh

# 模型必须落到数据盘，不要写进 30G 系统盘
mkdir -p /root/rivermind-data/ollama
export OLLAMA_MODELS=/root/rivermind-data/ollama
echo 'export OLLAMA_MODELS=/root/rivermind-data/ollama' >> ~/.bashrc

tmux new -s ollama
ollama serve
```

另开 SSH：

```bash
export OLLAMA_MODELS=/root/rivermind-data/ollama
ollama pull qwen3.8:27b
ollama run qwen3.8:27b
```

本机隧道：

```bash
ssh -CNg -L 11434:127.0.0.1:11434 root@fj01-ssh.gpuhome.cc -p 30522
```

本地启动 Desk：

```bash
PORT=3217 OLLAMA_BASE_URL=http://127.0.0.1:11434 npm start
```

## 6. 什么时候再上 SGLang

同时满足再换：

- 卡变成 **48G+**，或官方出了确认能进 24G 的 W4 配方
- 你要官方 FP8/BF16 质量、MTP 投机解码、256K 级上下文
- 已经能接受重装一套环境

48G+ 上的方向（**不要在当前 4090 上执行**）：

```bash
# 仅作对照，当前机器会 OOM
python -m sglang.launch_server \
  --model-path Qwen/Qwen3.8-27B-FP8 \
  --host 0.0.0.0 \
  --port 30000 \
  --trust-remote-code \
  --context-length 32768 \
  --reasoning-parser qwen3
```

官方入口：

- SGLang：[Qwen3.8-27B Cookbook](https://docs.sglang.io/cookbook/autoregressive/Qwen/Qwen3.8-27B)
- 权重：`Qwen/Qwen3.8-27B`、`Qwen/Qwen3.8-27B-FP8`

## 7. 和 OllamaDesk 怎么接

| 远端跑的是 | Desk 能不能直接用 | 做法 |
| --- | --- | --- |
| Ollama `qwen3.8:27b` | 能 | 隧道 11434，然后 `OLLAMA_BASE_URL=http://127.0.0.1:11434 npm start` |
| vLLM `/v1` | 不能直接 | Desk 当前只代理 Ollama `/api/chat`。vLLM 用 OpenAI SDK、curl，或以后给 Desk 加 OpenAI 兼容后端 |

当前建议：先把 vLLM 在 8000 跑通并 curl 验收；Desk 要无缝接入再并行起 Ollama，或改 Desk。

## 8. 排障

**启动立刻 CUDA OOM**

1. 确认下的不是 BF16 / FP8：`du -sh /root/rivermind-data/models/*`
2. 把 `--max-model-len` 降到 `4096`
3. 加上 `--language-model-only`（不要视觉，省视觉塔显存）
4. `--gpu-memory-utilization` 降到 `0.85`
5. `nvidia-smi` 看是否有别的进程占卡

**系统盘或数据盘写满**

```bash
df -h /
df -h /root/rivermind-data
du -sh /root/.cache /root/rivermind-data/* 2>/dev/null
```

缓存必须在 `/root/rivermind-data/cache`。如果模型落到了 `/root/.cache`，停掉下载并改环境变量后重来。

**Hugging Face 超时**

```bash
export HF_ENDPOINT=https://hf-mirror.com
```

官方 BF16 在 ModelScope 一般是 `Qwen/Qwen3.8-27B`，但那份太大，这台机器不要下。量化包若魔搭没有，继续走 HF 镜像。

**vLLM 报不认识 Qwen3.8 / Gated DeltaNet**

vLLM 太旧。升级到最新版后再启动，不要用半年前的 wheel。

**能聊天但 tool_calls 为空**

补 `--enable-auto-tool-choice --tool-call-parser qwen3_xml`。这是解析器问题，通常不是量化坏了。

**SSH 断了服务没了**

用 tmux 启动。`tmux ls` 看到 `qwen38` 或 `ollama` 再重连。

**想加长上下文**

按 `8192 → 16384 → 32768` 台阶试，每步看 `nvidia-smi`。出现 KV cache 不足就退回上一档。24G 上不要追求官方 256K。

## 9. 建议操作顺序

1. SSH 登录，确认 `nvidia-smi` 空闲、`df -h /root/rivermind-data` 大约 49G。
2. 按 4.1–4.3 装 vLLM、下载约 18GB 的 W4A16。
3. 按 4.4 用 `max-model-len 8192` 启动。
4. 机器内 curl `/v1/models` 和一轮对话。
5. 本机开 SSH 隧道，再用 OpenAI SDK 打一发。
6. 只有 Desk 要无缝接入时，再走第 5 节 Ollama。

不要并行下载 BF16「备份一份」。这台实例的盘和卡都装不下。
