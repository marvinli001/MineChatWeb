<!-- File: openai-audio-and-speech.md -->
# Audio and speech

**Source:** https://platform.openai.com/docs/guides/audio

本页为 *Audio and speech* 的**纯净 Markdown**重排：去侧栏与杂项，仅保留开发相关内容与示例。

---

## Overview

OpenAI API 提供一系列音频能力：可将**音频作为输入**、生成**音频作为输出**，或两者兼具。若你已明确需求，可直达相应指南；否则本文作为概览。

- **Build voice agents**：/docs/guides/voice-agents — 构建交互式语音应用。  
- **Transcribe audio**：/docs/guides/speech-to-text — 语音转文本（ASR）。  
- **Speak text**：/docs/guides/text-to-speech — 文本转语音（TTS）。

---

## A tour of audio use cases

- **Voice agents**：理解语音并以自然语言响应。两条路径：  
  1) **Speech-to-speech 模型 + Realtime API**（更低时延，更自然）；  
  2) **ASR → LLM → TTS 链式**（易扩展文本代理为语音代理，控制力更强）。若已使用 Agents SDK，可用链式方式为现有代理加语音。

- **Streaming audio**：通过 **Realtime API** 实时处理音频输入/输出，适合低延迟应用（含转写）。

- **Text to speech**：使用 **Audio API** 的 `audio/speech` 端点。兼容模型：`gpt-4o-mini-tts`, `tts-1`, `tts-1-hd`。可控制说话方式与音色。

- **Speech to text**：使用 **Audio API** 的 `audio/transcriptions`。兼容模型：`gpt-4o-transcribe`, `gpt-4o-mini-transcribe`, `whisper-1`。支持流式持续转写。

---

## Choosing the right API

多种 API 可用于转写或生成音频：

| API | 支持模态 | 流式支持 |
|---|---|---|
| **Realtime API** | 音频与文本的输入/输出 | 音频**进/出**流式 |
| **Chat Completions API** | 音频与文本的输入/输出 | 音频**出**流式 |
| **Transcription API** | 仅音频输入 | 音频**出**流式 |
| **Speech API** | 文本输入、音频输出 | 音频**出**流式 |

**General vs. Specialized**：  
- **通用**（Realtime / Chat Completions）：可利用最新模型的原生音频理解/生成，并结合函数调用等特性，覆盖面广。  
- **专用**（Transcription / Translation / Speech）：面向特定模型与用途，聚焦单一任务。

**对话式 vs. 可控性**：  
- 若追求对话自然度，使用 **Realtime** 或 **Chat Completions**（前者更低延迟）。模型直接生成音频，**不可完全预知**具体措辞。  
- 若追求**可预测与可控**（明确知道要说什么），使用 **ASR → LLM → TTS** 链式，但会引入额外时延。

**建议**：  
- 需要**实时交互/转写** → 选 **Realtime API**。  
- 不需严格实时，但需要**函数调用**等特性构建语音代理 → 选 **Chat Completions API**。  
- 单一用途（仅转写、仅翻译、仅合成） → 选 **Transcription/Translation/Speech** API。

---

## Add audio to your existing application

诸如 **GPT-4o / GPT-4o mini** 等模型是**原生多模态**：可理解并生成多种模态。若你已有使用 **Chat Completions** 的文本应用，可在 `modalities` 中加入 `audio` 并使用音频模型（如 `gpt-4o-audio-preview`），即可支持**音频输入/输出**。

> 目前 **Responses API 暂不支持音频**。

---

## Audio output from model

创建贴近人声的音频响应。

### JavaScript
```javascript
import { writeFileSync } from "node:fs";
import OpenAI from "openai";

const openai = new OpenAI();

// 生成音频响应
const response = await openai.chat.completions.create({
  model: "gpt-4o-audio-preview",
  modalities: ["text", "audio"],
  audio: { voice: "alloy", format: "wav" },
  messages: [{ role: "user", content: "Is a golden retriever a good family dog?" }],
  store: true,
});

// 检查返回数据
console.log(response.choices[0]);

// 写入文件
writeFileSync(
  "dog.wav",
  Buffer.from(response.choices[0].message.audio.data, "base64"),
  { encoding: "utf-8" }
);
```

### Python
```python
import base64
from openai import OpenAI

client = OpenAI()

completion = client.chat.completions.create(
    model="gpt-4o-audio-preview",
    modalities=["text", "audio"],
    audio={"voice": "alloy", "format": "wav"},
    messages=[{"role": "user", "content": "Is a golden retriever a good family dog?"}],
)

print(completion.choices[0])

wav_bytes = base64.b64decode(completion.choices[0].message.audio.data)
with open("dog.wav", "wb") as f:
    f.write(wav_bytes)
```

### cURL
```bash
curl "https://api.openai.com/v1/chat/completions"   -H "Content-Type: application/json"   -H "Authorization: Bearer $OPENAI_API_KEY"   -d '{
    "model": "gpt-4o-audio-preview",
    "modalities": ["text", "audio"],
    "audio": { "voice": "alloy", "format": "wav" },
    "messages": [{ "role": "user", "content": "Is a golden retriever a good family dog?" }]
  }'
```

---

## Audio input to model

向模型提供音频作为提示。

### JavaScript
```javascript
import OpenAI from "openai";
const openai = new OpenAI();

// 获取音频文件并转为 base64
const url = "https://cdn.openai.com/API/docs/audio/alloy.wav";
const audioResponse = await fetch(url);
const buffer = await audioResponse.arrayBuffer();
const base64str = Buffer.from(buffer).toString("base64");

const response = await openai.chat.completions.create({
  model: "gpt-4o-audio-preview",
  modalities: ["text", "audio"],
  audio: { voice: "alloy", format: "wav" },
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "What is in this recording?" },
        { type: "input_audio", input_audio: { data: base64str, format: "wav" } }
      ]
    }
  ],
  store: true,
});

console.log(response.choices[0]);
```

### Python
```python
import base64
import requests
from openai import OpenAI

client = OpenAI()

# 拉取音频并转为 base64
url = "https://cdn.openai.com/API/docs/audio/alloy.wav"
response = requests.get(url)
response.raise_for_status()
encoded_string = base64.b64encode(response.content).decode("utf-8")

completion = client.chat.completions.create(
    model="gpt-4o-audio-preview",
    modalities=["text", "audio"],
    audio={"voice": "alloy", "format": "wav"},
    messages=[
        {
            "role": "user",
            "content": [
                { "type": "text", "text": "What is in this recording?" },
                { "type": "input_audio", "input_audio": { "data": encoded_string, "format": "wav" } }
            ]
        }
    ]
)

print(completion.choices[0].message)
```

### cURL
```bash
curl "https://api.openai.com/v1/chat/completions"   -H "Content-Type: application/json"   -H "Authorization: Bearer $OPENAI_API_KEY"   -d '{
    "model": "gpt-4o-audio-preview",
    "modalities": ["text", "audio"],
    "audio": { "voice": "alloy", "format": "wav" },
    "messages": [
      {
        "role": "user",
        "content": [
          { "type": "text", "text": "What is in this recording?" },
          { "type": "input_audio", "input_audio": { "data": "<base64 bytes here>", "format": "wav" } }
        ]
      }
    ]
  }'
```

---

*以上为你提供的原始内容整理为 Markdown 的版本，便于直接纳入仓库或知识库。*
