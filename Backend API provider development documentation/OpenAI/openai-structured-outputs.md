<!-- File: openai-structured-outputs.md -->
# Structured model outputs

**Source:** https://platform.openai.com/docs/guides/structured-outputs

本页为 *Structured Outputs* 的**纯净 Markdown**重排：去侧栏与杂项，仅保留开发相关说明与可运行示例。

---

## Overview

**Structured Outputs** 让模型输出**严格符合**你提供的 **JSON Schema**。好处：
1. **类型安全**：不再因缺键/错枚举而反复校验与重试。  
2. **可编程拒绝**：安全拒答可被程序检测到。  
3. **更简单的提示**：无需靠强提示词去“约束格式”。

> Python/JS SDK 还支持直接用 **Pydantic** / **Zod** 定义模式并解析为强类型对象。

---

## Getting a structured response（以代码定义 Schema 并解析）

### JavaScript（Zod）
```javascript
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const openai = new OpenAI();

const CalendarEvent = z.object({
  name: z.string(),
  date: z.string(),
  participants: z.array(z.string()),
});

const response = await openai.responses.parse({
  model: "gpt-4o-2024-08-06",
  input: [
    { role: "system", content: "Extract the event information." },
    { role: "user", content: "Alice and Bob are going to a science fair on Friday." },
  ],
  text: { format: zodTextFormat(CalendarEvent, "event") },
});

const event = response.output_parsed;
```

### Python（Pydantic）
```python
from openai import OpenAI
from pydantic import BaseModel

client = OpenAI()

class CalendarEvent(BaseModel):
    name: str
    date: str
    participants: list[str]

response = client.responses.parse(
    model="gpt-4o-2024-08-06",
    input=[
        {"role": "system", "content": "Extract the event information."},
        {"role": "user", "content": "Alice and Bob are going to a science fair on Friday."},
    ],
    text_format=CalendarEvent,
)

event = response.output_parsed
```

**支持模型**：从 **GPT‑4o** 系列新快照开始全面支持；更早模型（如 gpt‑4‑turbo）通常使用 **JSON mode**。

---

## 何时用 function calling，何时用 `text.format`

- **Function calling**：当你要把模型接入**你系统的功能**（查库、调 UI、外部 API）时。  
- **`response_format` / `text.format`**：当你只是想**约束模型对用户的回复结构**（如前端 UI 需要稳定字段）时。

**口诀**：接工具/数据 → 用 **function calling**；约束回复结构 → 用 **structured `text.format`**。

> 下文聚焦 **Responses API** 下的非 function-calling 用法。function calling 结合结构化输出见：/docs/guides/function-calling#function-calling-with-structured-outputs

---

## Structured Outputs vs. JSON mode

| 能力 | Structured Outputs | JSON mode |
|---|---|---|
| 产出为**有效 JSON** | ✅ | ✅ |
| **严格遵循 Schema** | ✅ | ❌ |
| 兼容模型 | `gpt-4o-mini`, `gpt-4o-2024-08-06` 及以后 | `gpt-3.5-turbo`, `gpt-4-*`, `gpt-4o-*` |
| 启用方式 | `text: { format: { type: "json_schema", strict: true, schema: ... } }` | `text: { format: { type: "json_object" } }` |

建议优先使用 **Structured Outputs**。

---

## Examples

### 1) Chain of thought（结构化步骤讲解）

#### JavaScript（Zod）
```javascript
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const openai = new OpenAI();

const Step = z.object({ explanation: z.string(), output: z.string() });
const MathReasoning = z.object({ steps: z.array(Step), final_answer: z.string() });

const response = await openai.responses.parse({
  model: "gpt-4o-2024-08-06",
  input: [
    { role: "system", content: "You are a helpful math tutor. Guide the user step by step." },
    { role: "user", content: "how can I solve 8x + 7 = -23" },
  ],
  text: { format: zodTextFormat(MathReasoning, "math_reasoning") },
});

const math_reasoning = response.output_parsed;
```

#### Python（Pydantic）
```python
from openai import OpenAI
from pydantic import BaseModel

client = OpenAI()

class Step(BaseModel):
    explanation: str
    output: str

class MathReasoning(BaseModel):
    steps: list[Step]
    final_answer: str

response = client.responses.parse(
    model="gpt-4o-2024-08-06",
    input=[
        {"role": "system", "content": "You are a helpful math tutor. Guide the user step by step."},
        {"role": "user", "content": "how can I solve 8x + 7 = -23"},
    ],
    text_format=MathReasoning,
)

math_reasoning = response.output_parsed
```

#### cURL（JSON Schema 直传）
```bash
curl https://api.openai.com/v1/responses   -H "Authorization: Bearer $OPENAI_API_KEY"   -H "Content-Type: application/json"   -d '{
    "model": "gpt-4o-2024-08-06",
    "input": [
      {"role": "system","content":"You are a helpful math tutor. Guide the user step by step."},
      {"role": "user","content":"how can I solve 8x + 7 = -23"}
    ],
    "text": {
      "format": {
        "type": "json_schema",
        "name": "math_reasoning",
        "schema": {
          "type": "object",
          "properties": {
            "steps": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "explanation": { "type": "string" },
                  "output": { "type": "string" }
                },
                "required": ["explanation","output"],
                "additionalProperties": false
              }
            },
            "final_answer": { "type": "string" }
          },
          "required": ["steps","final_answer"],
          "additionalProperties": false
        },
        "strict": true
      }
    }
  }'
```

**示例响应（节选）**
```json
{
  "steps": [
    { "explanation": "Start with the equation 8x + 7 = -23.", "output": "8x + 7 = -23" },
    { "explanation": "Subtract 7 from both sides.", "output": "8x = -30" },
    { "explanation": "Divide both sides by 8.", "output": "x = -30 / 8" },
    { "explanation": "Simplify the fraction.", "output": "x = -15 / 4" }
  ],
  "final_answer": "x = -15 / 4"
}
```

---

### 2) Structured data extraction（结构化抽取）

#### JavaScript
```javascript
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const openai = new OpenAI();

const ResearchPaperExtraction = z.object({
  title: z.string(),
  authors: z.array(z.string()),
  abstract: z.string(),
  keywords: z.array(z.string()),
});

const response = await openai.responses.parse({
  model: "gpt-4o-2024-08-06",
  input: [
    { role: "system", content: "You are an expert at structured data extraction..." },
    { role: "user", content: "..." },
  ],
  text: { format: zodTextFormat(ResearchPaperExtraction, "research_paper_extraction") },
});

const research_paper = response.output_parsed;
```

#### Python
```python
from openai import OpenAI
from pydantic import BaseModel

client = OpenAI()

class ResearchPaperExtraction(BaseModel):
    title: str
    authors: list[str]
    abstract: str
    keywords: list[str]

response = client.responses.parse(
    model="gpt-4o-2024-08-06",
    input=[
        {"role": "system", "content": "You are an expert at structured data extraction..."},
        {"role": "user", "content": "..."}
    ],
    text_format=ResearchPaperExtraction,
)

research_paper = response.output_parsed
```

#### cURL
```bash
curl https://api.openai.com/v1/responses   -H "Authorization: Bearer $OPENAI_API_KEY"   -H "Content-Type: application/json"   -d '{
    "model": "gpt-4o-2024-08-06",
    "input": [
      {"role": "system","content":"You are an expert at structured data extraction..."},
      {"role": "user","content":"..."}
    ],
    "text": {
      "format": {
        "type": "json_schema",
        "name": "research_paper_extraction",
        "schema": {
          "type": "object",
          "properties": {
            "title": { "type": "string" },
            "authors": { "type": "array", "items": { "type": "string" } },
            "abstract": { "type": "string" },
            "keywords": { "type": "array", "items": { "type": "string" } }
          },
          "required": ["title","authors","abstract","keywords"],
          "additionalProperties": false
        },
        "strict": true
      }
    }
  }'
```

---

### 3) UI generation（递归 Schema 约束）

#### JavaScript
```javascript
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const openai = new OpenAI();

const UI = z.lazy(() =>
  z.object({
    type: z.enum(["div","button","header","section","field","form"]),
    label: z.string(),
    children: z.array(UI),
    attributes: z.array(z.object({ name: z.string(), value: z.string() })),
  })
);

const response = await openai.responses.parse({
  model: "gpt-4o-2024-08-06",
  input: [
    { role: "system", content: "You are a UI generator AI. Convert the user input into a UI." },
    { role: "user", content: "Make a User Profile Form" },
  ],
  text: { format: zodTextFormat(UI, "ui") },
});

const ui = response.output_parsed;
```

#### Python
```python
from enum import Enum
from typing import List
from openai import OpenAI
from pydantic import BaseModel

client = OpenAI()

class UIType(str, Enum):
    div = "div"; button = "button"; header = "header"
    section = "section"; field = "field"; form = "form"

class Attribute(BaseModel):
    name: str
    value: str

class UI(BaseModel):
    type: UIType
    label: str
    children: List["UI"]
    attributes: List[Attribute]

UI.model_rebuild()  # 启用递归类型

class Response(BaseModel):
    ui: UI

response = client.responses.parse(
    model="gpt-4o-2024-08-06",
    input=[
        {"role": "system", "content": "You are a UI generator AI. Convert the user input into a UI."},
        {"role": "user", "content": "Make a User Profile Form"},
    ],
    text_format=Response,
)

ui = response.output_parsed
```

#### cURL（示例 Schema 见下节“递归/definitions 支持”）

---

### 4) Moderation（结构化多类目判定）

#### JavaScript
```javascript
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const openai = new OpenAI();

const ContentCompliance = z.object({
  is_violating: z.boolean(),
  category: z.enum(["violence","sexual","self_harm"]).nullable(),
  explanation_if_violating: z.string().nullable(),
});

const response = await openai.responses.parse({
  model: "gpt-4o-2024-08-06",
  input: [
    { role: "system", content: "Determine if the user input violates specific guidelines and explain if they do." },
    { role: "user", content: "How do I prepare for a job interview?" }
  ],
  text: { format: zodTextFormat(ContentCompliance, "content_compliance") },
});

const compliance = response.output_parsed;
```

#### Python
```python
from enum import Enum
from typing import Optional
from openai import OpenAI
from pydantic import BaseModel

client = OpenAI()

class Category(str, Enum):
    violence = "violence"; sexual = "sexual"; self_harm = "self_harm"

class ContentCompliance(BaseModel):
    is_violating: bool
    category: Optional[Category]
    explanation_if_violating: Optional[str]

response = client.responses.parse(
    model="gpt-4o-2024-08-06",
    input=[
        {"role": "system","content":"Determine if the user input violates specific guidelines and explain if they do."},
        {"role": "user","content":"How do I prepare for a job interview?"},
    ],
    text_format=ContentCompliance,
)

compliance = response.output_parsed
```

---

## How to use via `text.format`

**Step 1：定义 JSON Schema**（或用 Zod/Pydantic 生成）。注意：Structured Outputs 支持 **JSON Schema 子集**（见下节）。

**Step 2：在请求中提供 Schema**
### Python
```python
response = client.responses.create(
    model="gpt-4o-2024-08-06",
    input=[
        {"role": "system", "content": "You are a helpful math tutor. Guide the user step by step."},
        {"role": "user", "content": "how can I solve 8x + 7 = -23"}
    ],
    text={
        "format": {
            "type": "json_schema",
            "name": "math_response",
            "schema": {
                "type": "object",
                "properties": {
                    "steps": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "explanation": {"type": "string"},
                                "output": {"type": "string"}
                            },
                            "required": ["explanation", "output"],
                            "additionalProperties": False
                        }
                    },
                    "final_answer": {"type": "string"}
                },
                "required": ["steps", "final_answer"],
                "additionalProperties": False
            },
            "strict": True
        }
    }
)
print(response.output_text)
```

### JavaScript
```javascript
const response = await openai.responses.create({
  model: "gpt-4o-2024-08-06",
  input: [
    { role: "system", content: "You are a helpful math tutor. Guide the user step by step." },
    { role: "user", content: "how can I solve 8x + 7 = -23" }
  ],
  text: {
    format: {
      type: "json_schema",
      name: "math_response",
      schema: {
        type: "object",
        properties: {
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: { explanation: { type: "string" }, output: { type: "string" } },
              required: ["explanation","output"],
              additionalProperties: false
            }
          },
          final_answer: { type: "string" }
        },
        required: ["steps","final_answer"],
        additionalProperties: false
      },
      strict: true
    }
  }
});
console.log(response.output_text);
```

### cURL
```bash
curl https://api.openai.com/v1/responses   -H "Authorization: Bearer $OPENAI_API_KEY"   -H "Content-Type: application/json"   -d '{ "model": "gpt-4o-2024-08-06", "input": [...], "text": { "format": { "type": "json_schema", "name": "math_response", "schema": { ... }, "strict": true }}}'
```

> 首次使用某个 Schema 会有**一次性额外时延**；后续相同 Schema 不再增加延时。

**Step 3：处理边界情况**（拒绝、截断、过滤等）
```javascript
try {
  const response = await openai.responses.create({
    model: "gpt-4o-2024-08-06",
    input: [
      { role: "system", content: "You are a helpful math tutor. Guide the user step by step." },
      { role: "user", content: "how can I solve 8x + 7 = -23" }
    ],
    max_output_tokens: 50,
    text: { format: { type: "json_schema", name: "math_response", schema: { /* ... */ }, strict: true } }
  });

  if (response.status === "incomplete" && response.incomplete_details.reason === "max_output_tokens") {
    throw new Error("Incomplete response");
  }

  const first = response.output[0]?.content[0];
  if (first?.type === "refusal") {
    console.log(first.refusal); // 处理拒绝
  } else if (first?.type === "output_text") {
    console.log(first.text);
  } else {
    throw new Error("No response content");
  }
} catch (e) {
  console.error(e);
}
```

还可在 **Chat Completions** 中解析并检测 `refusal` 字段（JS/Python 略）。

---

## Streaming（流式结构化输出）

可以一边生成一边解析 JSON 字段或函数参数。建议用 SDK 处理流事件。

### Python
```python
from typing import List
from openai import OpenAI
from pydantic import BaseModel

class EntitiesModel(BaseModel):
    attributes: List[str]
    colors: List[str]
    animals: List[str]

client = OpenAI()

with client.responses.stream(
    model="gpt-4.1",
    input=[
        {"role": "system", "content": "Extract entities from the input text"},
        {"role": "user", "content": "The quick brown fox jumps over the lazy dog with piercing blue eyes"},
    ],
    text_format=EntitiesModel,
) as stream:
    for event in stream:
        if event.type == "response.refusal.delta":
            print(event.delta, end="")
        elif event.type == "response.output_text.delta":
            print(event.delta, end="")
        elif event.type == "response.error":
            print(event.error, end="")
        elif event.type == "response.completed":
            print("Completed")
    final_response = stream.get_final_response()
    print(final_response)
```

### JavaScript
```javascript
import { OpenAI } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const EntitiesSchema = z.object({
  attributes: z.array(z.string()),
  colors: z.array(z.string()),
  animals: z.array(z.string()),
});

const openai = new OpenAI();
const stream = openai.responses
  .stream({
    model: "gpt-4.1",
    input: [{ role: "user", content: "What's the weather like in Paris today?" }],
    text: { format: zodTextFormat(EntitiesSchema, "entities") },
  })
  .on("response.refusal.delta", (e) => process.stdout.write(e.delta))
  .on("response.output_text.delta", (e) => process.stdout.write(e.delta))
  .on("response.output_text.done", () => process.stdout.write("\n"))
  .on("response.error", (e) => console.error(e.error));

const result = await stream.finalResponse();
console.log(result);
```

---

## Supported schemas（支持的 JSON Schema 子集）

**支持类型**：`string` / `number` / `boolean` / `integer` / `object` / `array` / `enum` / `anyOf`。

**附加约束（部分）**：
- **string**：`pattern`、`format`（`date-time`、`time`、`date`、`duration`、`email`、`hostname`、`ipv4`、`ipv6`、`uuid`）。  
- **number**：`multipleOf`、`maximum`/`exclusiveMaximum`、`minimum`/`exclusiveMinimum`。  
- **array**：`minItems`、`maxItems`。

### 示例：字符串限制
```json
{
  "name": "user_data",
  "strict": true,
  "schema": {
    "type": "object",
    "properties": {
      "name": { "type": "string", "description": "The name of the user" },
      "username": {
        "type": "string",
        "description": "Must start with @",
        "pattern": "^@[a-zA-Z0-9_]+$"
      },
      "email": { "type": "string", "format": "email" }
    },
    "additionalProperties": false,
    "required": ["name","username","email"]
  }
}
```

### 示例：数字限制
```json
{
  "name": "weather_data",
  "strict": true,
  "schema": {
    "type": "object",
    "properties": {
      "location": { "type": "string" },
      "unit": { "type": ["string","null"], "enum": ["F","C"] },
      "value": { "type": "number", "minimum": -130, "maximum": 130 }
    },
    "additionalProperties": false,
    "required": ["location","unit","value"]
  }
}
```

**根对象必须是 `object`，且不可用顶层 `anyOf`**（某些 Zod 判别联合会生成顶层 anyOf，需避免）。

**所有字段必须 `required`**：如需“可选”，使用 `["string","null"]` 等联合模拟。

**规模限制**：
- 最多 **10 层嵌套**，**≤ 5000** 个 object 属性总和。  
- Schema 中字符串总长度（属性名/定义名/枚举值/const 值）≤ **120,000**。  
- 枚举总数 ≤ **1000**；单枚举在 >250 值时，所有枚举值串长合计 ≤ **15,000**。

**必须设置**：`"additionalProperties": false`。键顺序将按 Schema 中的顺序产出。

**不支持的关键词（部分）**：`allOf`, `not`, `dependentRequired`, `dependentSchemas`, `if/then/else` 等。  
**微调模型**下的额外不支持：`minLength/maxLength/pattern/format`（string），`minimum/maximum/multipleOf`（number），`patternProperties`（object），`minItems/maxItems`（array）。

### anyOf（受限支持）
```json
{
  "type": "object",
  "properties": {
    "item": {
      "anyOf": [
        {
          "type": "object",
          "properties": { "name": { "type": "string" }, "age": { "type": "number" } },
          "additionalProperties": false,
          "required": ["name","age"]
        },
        {
          "type": "object",
          "properties": {
            "number": { "type": "string" },
            "street": { "type": "string" },
            "city": { "type": "string" }
          },
          "additionalProperties": false,
          "required": ["number","street","city"]
        }
      ]
    }
  },
  "additionalProperties": false,
  "required": ["item"]
}
```

### `$defs` / 递归 Schema 支持（示例）
```json
{
  "type": "object",
  "properties": {
    "steps": { "type": "array", "items": { "$ref": "#/$defs/step" } },
    "final_answer": { "type": "string" }
  },
  "$defs": {
    "step": {
      "type": "object",
      "properties": { "explanation": { "type": "string" }, "output": { "type": "string" } },
      "required": ["explanation","output"],
      "additionalProperties": false
    }
  },
  "required": ["steps","final_answer"],
  "additionalProperties": false
}
```

递归到自身：
```json
{
  "type": "object",
  "properties": { "linked_list": { "$ref": "#/$defs/linked_list_node" } },
  "$defs": {
    "linked_list_node": {
      "type": "object",
      "properties": {
        "value": { "type": "number" },
        "next": { "anyOf": [{ "$ref": "#/$defs/linked_list_node" }, { "type": "null" }] }
      },
      "additionalProperties": false,
      "required": ["next","value"]
    }
  },
  "additionalProperties": false,
  "required": ["linked_list"]
}
```

---

## JSON mode（对比 & 边界处理）

**JSON mode** 只保证“输出可解析为 JSON”，**不保证**符合某个 Schema。若用 JSON mode：
- **必须**在上下文中明确指示“只输出 JSON”（否则可能输出连续空白直到 token 用尽）。  
- 需自行校验与重试，或配合验证库。

### 处理边界（JS 示例）
```javascript
const we_did_not_specify_stop_tokens = true;
try {
  const response = await openai.responses.create({
    model: "gpt-3.5-turbo-0125",
    input: [
      { role: "system", content: "You are a helpful assistant designed to output JSON." },
      { role: "user", content: "Who won the world series in 2020? Please respond in the format {winner: ...}" }
    ],
    text: { format: { type: "json_object" } }
  });

  if (response.status === "incomplete" && response.incomplete_details.reason === "max_output_tokens") { /* handle */ }
  if (response.output[0].content[0].type === "refusal") { console.log(response.output[0].content[0].refusal) }
  if (response.status === "completed") {
    if (we_did_not_specify_stop_tokens) {
      console.log(JSON.parse(response.output_text));
    } else {
      // handle stop tokens
    }
  }
} catch (e) { console.error(e); }
```

---

## Refusals（拒绝）

使用 Structured Outputs 时，若模型出于安全原因**拒绝**，输出中会出现 `refusal` 项，这不一定遵循你的 Schema。前端/服务端应检测并分支处理。

---

## Resources
- 结构化输出入门 Cookbook  
- 用 Structured Outputs 构建多 Agent 系统

---

*本页将你提供的原始内容整理为 Markdown，便于直接纳入仓库/知识库。*
