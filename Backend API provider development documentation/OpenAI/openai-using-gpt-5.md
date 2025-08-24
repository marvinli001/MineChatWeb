# Using GPT-5 — 开发者精要指南

> 本文基于你提供的页面内容整理：移除了侧边栏与站点噪音，仅保留与开发相关的要点、示例与最佳实践，统一为 Markdown。

---

## 概览

**GPT‑5** 是目前最智能的通用模型系列，特别擅长：

- 代码生成 / 修复 / 重构
- 严格的指令遵循（instruction following）
- 长上下文与工具调用（function/custom tools/MCP 等）

本文涵盖：快速开始、模型选择、新增 API 能力（最小推理、输出冗长度、Custom Tools、Allowed Tools、Preambles）、迁移指引（含 Chat Completions → Responses 对照）、提示词实践、常见问题。

---

## 快速开始

### 更快的响应（低推理 + 低冗长度）

> 当你更看重时延或成本，而任务不需要强推理时，降低推理开销与文本冗长度。

**JavaScript**

```js
import OpenAI from "openai";
const openai = new OpenAI();

const result = await openai.responses.create({
  model: "gpt-5",
  input: "Write a haiku about code.",
  reasoning: { effort: "low" },
  text: { verbosity: "low" },
});

console.log(result.output_text);
```

**Python**

```python
from openai import OpenAI
client = OpenAI()

result = client.responses.create(
    model="gpt-5",
    input="Write a haiku about code.",
    reasoning={"effort": "low"},
    text={"verbosity": "low"},
)

print(result.output_text)
```

**curl**

```bash
curl https://api.openai.com/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-5",
    "input": "Write a haiku about code.",
    "reasoning": { "effort": "low" }
  }'
```

### 编码与复杂任务（高推理）

> 复杂调试、规划、多步骤代理任务等，建议提高推理开销。

**JavaScript**

```js
import OpenAI from "openai";
const openai = new OpenAI();

const result = await openai.responses.create({
  model: "gpt-5",
  input: "Find the null pointer exception: ...your code here...",
  reasoning: { effort: "high" },
});

console.log(result.output_text);
```

**Python**

```python
from openai import OpenAI
client = OpenAI()

result = client.responses.create(
    model="gpt-5",
    input="Find the null pointer exception: ...your code here...",
    reasoning={"effort": "high"},
)

print(result.output_text)
```

**curl**

```bash
curl https://api.openai.com/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-5",
    "input": "Find the null pointer exception: ...your code here...",
    "reasoning": { "effort": "high" }
  }'
```

---

## 模型选择（GPT‑5 系列）

| 变体        | 适用场景 |
|-------------|----------|
| **gpt-5**   | 复杂推理、广泛世界知识、代码密集/多步骤代理任务 |
| **gpt-5-mini** | 成本优化的推理/聊天，平衡速度、成本与能力 |
| **gpt-5-nano** | 高吞吐、简单指令/分类等确定性任务 |

**系统卡名 ↔ API 别名**

| 系统卡名称             | API 名称          |
|------------------------|-------------------|
| gpt-5-thinking         | gpt-5             |
| gpt-5-thinking-mini    | gpt-5-mini        |
| gpt-5-thinking-nano    | gpt-5-nano        |
| gpt-5-main             | gpt-5-chat-latest |
| gpt-5-main-mini        | N/A（API 不提供） |

---

## GPT‑5 新增 / 强化特性

### 1) Minimal reasoning effort（**最小推理**）

- 通过 `reasoning.effort: "minimal"` 最小化推理 token 以获得最快 TTFB。
- 对编码与指令遵循尤为高效；如需更主动/更深入的思考，可在提示词中明确要求“先概述步骤/再作答”。

**示例：**

```bash
curl --request POST https://api.openai.com/v1/responses \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-type: application/json" \
  -d '{
    "model": "gpt-5",
    "input": "How much gold would it take to coat the Statue of Liberty in a 1mm layer?",
    "reasoning": { "effort": "minimal" }
  }'
```

### 2) Verbosity（**输出冗长度**）

- 通过 `text.verbosity: "high" | "medium" | "low"` 控制输出 token 数量范围。
- 低冗长度适合：简洁答复、直出 SQL/命令等；高冗长度适合：长文档解释、重构说明。

**示例（低冗长度）：**

```bash
curl --request POST https://api.openai.com/v1/responses \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-type: application/json" \
  -d '{
    "model": "gpt-5",
    "input": "What is the answer to the ultimate question of life, the universe, and everything?",
    "text": { "verbosity": "low" }
  }'
```

### 3) **Custom Tools（自定义工具）**

- 使用 `{"type":"custom", "name": "...", "description": "..."}` 定义工具，模型可以发送**任意纯文本**作为工具输入（而不仅是 JSON）。
- 可选以**上下文无关文法（CFG）**（Lark / Regex）约束工具输入格式，适用于 SQL/DSL 等强约束场景。
- 详见 *Function calling* 指南中的 Custom Tools 与 Grammar 配置。

```json
{
  "type": "custom",
  "name": "code_exec",
  "description": "Executes arbitrary python code"
}
```

### 4) **Allowed Tools（允许工具子集）**

- 在请求里同时提供全部 `tools`，再用 `tool_choice: { "type":"allowed_tools", "mode":"auto|required", "tools":[...] }` 限制**本次**可用子集。
- 好处：提高安全性/可预测性，增强 prompt 缓存命中率，避免硬编码调用顺序。

```json
"tool_choice": {
  "type": "allowed_tools",
  "mode": "auto",
  "tools": [
    { "type": "function", "name": "get_weather" },
    { "type": "mcp", "server_label": "deepwiki" },
    { "type": "image_generation" }
  ]
}
```

### 5) **Preambles（前言说明）**

- 在调用工具前，让模型先输出一段**简短、对用户可见**的“调用动机/计划”（介于 CoT 与工具调用之间）。
- 做法：在 system/developer 提示里加入类似“在调用任何工具前，先简述你为何调用该工具”。
- 益处：可观察性更强、可调试性更好，在最小推理场景也能提升成功率与用户信任。

---

## 迁移指引

### 从其它模型迁移到 GPT‑5

- **从 o3**：优先尝试 `gpt-5` + `reasoning: "medium"`；若不达标再升到 `"high"`。
- **从 gpt‑4.1**：优先尝试 `gpt-5` + `"minimal"` 或 `"low"` 推理；按需微调提示。
- **从 o4-mini / gpt‑4.1-mini**：用 **gpt‑5‑mini**。
- **从 gpt‑4.1‑nano**：用 **gpt‑5‑nano**。

> **建议**：结合**提示优化器**迭代提示；Responses API 能在多轮中**传递推理项（CoT）**，常见收益为：更少推理 token、更高缓存命中、更低时延。

### 从 **Chat Completions** 迁移到 **Responses API**

核心差异：Responses 支持在多轮间传递**推理项（CoT）**。以下给出参数映射示例。

**最小推理**

- **Responses API**

```bash
curl -X POST https://api.openai.com/v1/responses \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-type: application/json" \
  -d '{
    "model": "gpt-5",
    "input": "How much gold would it take to coat the Statue of Liberty in a 1mm layer?",
    "reasoning": { "effort": "minimal" }
  }'
```

- **Chat Completions**

```bash
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-type: application/json" \
  -d '{
    "model": "gpt-5",
    "messages": [{ "role": "user", "content": "How much gold would it take to coat the Statue of Liberty in a 1mm layer?" }],
    "reasoning_effort": "minimal"
  }'
```

**冗长度**

- **Responses API**

```bash
curl -X POST https://api.openai.com/v1/responses \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-type: application/json" \
  -d '{
    "model": "gpt-5",
    "input": "What is the answer to the ultimate question of life, the universe, and everything?",
    "text": { "verbosity": "low" }
  }'
```

- **Chat Completions**

```bash
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-type: application/json" \
  -d '{
    "model": "gpt-5",
    "messages": [{ "role": "user", "content": "What is the answer to the ultimate question of life, the universe, and everything?" }],
    "verbosity": "low"
  }'
```

**Custom Tool 调用**

- **Responses API**

```bash
curl -X POST https://api.openai.com/v1/responses \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-type: application/json" \
  -d '{
    "model": "gpt-5",
    "input": "Use the code_exec tool to calculate the area of a circle with radius equal to the number of r letters in blueberry",
    "tools": [{ "type": "custom", "name": "code_exec", "description": "Executes arbitrary python code" }]
  }'
```

- **Chat Completions**

```bash
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-type: application/json" \
  -d '{
    "model": "gpt-5",
    "messages": [
      { "role": "user", "content": "Use the code_exec tool to calculate the area of a circle with radius equal to the number of r letters in blueberry" }
    ],
    "tools": [
      { "type": "custom", "custom": { "name": "code_exec", "description": "Executes arbitrary python code" } }
    ]
  }'
```

---

## 提示词与代理实践

- **GPT‑5 是推理模型**：会逐步分解问题并生成**内部**思维链。为最大化性能，在多轮交互与工具调用中**回传先前的推理项**（通过 `previous_response_id` 或将其加入 `input`）。
- 使用**提示优化器**在控制台迭代你的提示（适配不同推理级别与冗长度）。
- 前端工程/多工具编排/函数调用任务：结合 *Function Calling*、*Custom Tools + Grammar* 与 *Allowed Tools* 获得最佳的可靠性与可控性。

---

## 进一步阅读

- GPT‑5 提示指南（Prompting guide）  
- GPT‑5 前端开发提示样例  
- GPT‑5 新特性指南  
- 推理模型（Reasoning）Cookbook  
- Responses API 与 Chat Completions 对比

> 注：以上链接在你提供的原文中出现；若需我将其替换为内部跳转或补齐外链，请告知。

---

## 常见问题（FAQ 摘要）

1. **ChatGPT 内如何集成？** 有 gpt‑5‑chat 与 gpt‑5‑thinking 两类，前者偏“最小推理/路由”，后者可直接启用推理能力。
2. **是否支持 Codex / Codex CLI？** 是，`gpt-5` 将提供支持。
3. **旧模型的下线计划？** 关注官方 **Deprecations** 页面；下线前会提前通知。

---

## 速查清单（TL;DR）

- **快**：`reasoning.effort="minimal|low" + text.verbosity="low"`  
- **强**：`reasoning.effort="medium|high"`（复杂调试/多步骤代理）  
- **控**：使用 **Custom Tools + Grammar** 约束输入/输出；用 **Allowed Tools** 白名单当前可用工具  
- **迁移**：优先使用 **Responses API** 以传递 CoT；配合提示优化器提升稳定性与速度

