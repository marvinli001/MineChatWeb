<!-- File: openai-text-generation.md -->
# Text generation

**Source:** https://platform.openai.com/docs/guides/text

使用 OpenAI API，可以让大语言模型从提示词生成文本（如代码、公式、结构化 JSON、自然语言段落等）。以下内容为**纯净 Markdown**重排版：去除侧栏与无关元素，仅保留关键开发说明与示例。

---

## Generate text from a simple prompt

最小示例：从一个简单提示生成文本。

### JavaScript
```javascript
import OpenAI from "openai";
const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-5",
  input: "Write a one-sentence bedtime story about a unicorn."
});

console.log(response.output_text);
```

### Python
```python
from openai import OpenAI
client = OpenAI()

response = client.responses.create(
    model="gpt-5",
    input="Write a one-sentence bedtime story about a unicorn."
)

print(response.output_text)
```

### cURL
```bash
curl "https://api.openai.com/v1/responses"   -H "Content-Type: application/json"   -H "Authorization: Bearer $OPENAI_API_KEY"   -d '{
    "model": "gpt-5",
    "input": "Write a one-sentence bedtime story about a unicorn."
  }'
```

### Response 形状与 `output_text` 速用
- 模型输出位于响应对象的 `output` 数组中，数组里可能包含**多个**条目（如工具调用、推理元数据等），不要假设文本恒为 `output[0].content[0].text`。
- 官方 SDK 通常提供了**聚合文本**的 `output_text` 字段，便于快速拿到最终文本。

> 除了纯文本，还可返回**结构化 JSON**（见 *Structured Outputs*）。

---

## Prompt engineering

Prompt engineering 指为模型编写有效指令，使其**稳定**地产生符合要求的内容。生成式模型具有**非确定性**，因此需要技术与实践并用。

**强烈建议：**
- 将生产应用**固定到具体模型快照**（例如：`gpt-5-2025-08-07`），以保证行为一致性。
- 构建 **evals**（基准用例与评分），在你迭代提示词或升级模型版本时，持续**监控提示性能**。

下面是构造提示的常见方法与工具。

---

## Message roles & instruction following

可用 `instructions`（高优先级）与带不同 **role** 的 `input` 消息共同对模型“下达指令”。`instructions` 定义整体行为与语气，并**优先于** `input` 里的普通用户消息。

### Generate text with instructions

#### JavaScript
```javascript
import OpenAI from "openai";
const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-5",
  reasoning: { effort: "low" },
  instructions: "Talk like a pirate.",
  input: "Are semicolons optional in JavaScript?"
});

console.log(response.output_text);
```

#### Python
```python
from openai import OpenAI
client = OpenAI()

response = client.responses.create(
    model="gpt-5",
    reasoning={"effort": "low"},
    instructions="Talk like a pirate.",
    input="Are semicolons optional in JavaScript?",
)

print(response.output_text)
```

#### cURL
```bash
curl "https://api.openai.com/v1/responses"   -H "Content-Type: application/json"   -H "Authorization: Bearer $OPENAI_API_KEY"   -d '{
    "model": "gpt-5",
    "reasoning": {"effort": "low"},
    "instructions": "Talk like a pirate.",
    "input": "Are semicolons optional in JavaScript?"
  }'
```

### Generate text with messages using different roles

与上例等价，也可以在 `input` 中显式提供多角色消息：

#### JavaScript
```javascript
import OpenAI from "openai";
const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-5",
  reasoning: { effort: "low" },
  input: [
    { role: "developer", content: "Talk like a pirate." },
    { role: "user", content: "Are semicolons optional in JavaScript?" }
  ]
});

console.log(response.output_text);
```

#### Python
```python
from openai import OpenAI
client = OpenAI()

response = client.responses.create(
    model="gpt-5",
    reasoning={"effort": "low"},
    input=[
        { "role": "developer", "content": "Talk like a pirate." },
        { "role": "user", "content": "Are semicolons optional in JavaScript?" }
    ]
)

print(response.output_text)
```

#### cURL
```bash
curl "https://api.openai.com/v1/responses"   -H "Content-Type: application/json"   -H "Authorization: Bearer $OPENAI_API_KEY"   -d '{
    "model": "gpt-5",
    "reasoning": {"effort": "low"},
    "input": [
      { "role": "developer", "content": "Talk like a pirate." },
      { "role": "user", "content": "Are semicolons optional in JavaScript?" }
    ]
  }'
```

**注意：**
- `instructions` 只作用于**当前**请求。如果通过 `previous_response_id` 维护多轮会话，上一轮的 `instructions` 不会自动存在于上下文中。
- 模型会对不同 role 赋予不同优先级：
  - `developer`：应用开发者提供的规则和业务逻辑（优先级高于 `user`）。
  - `user`：终端用户提供的输入（优先级低于 `developer`）。
  - `assistant`：模型生成的消息。

---

## Reusable prompts

你可以在 OpenAI 控制台创建**可复用的提示**（带占位变量），然后在 API 中通过 `prompt` 参数引用，方便在不改动代码的前提下快速升级提示。

`prompt` 对象包含：
- `id`：提示在控制台中的唯一 ID
- `version`：指定版本（默认是控制台中的“current”版本）
- `variables`：一个字典；值可以是**字符串**或**其它输入类型**（如 `input_image` / `input_file`）

### A. String variables

#### JavaScript
```javascript
import OpenAI from "openai";
const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-5",
  prompt: {
    id: "pmpt_abc123",
    version: "2",
    variables: {
      customer_name: "Jane Doe",
      product: "40oz juice box"
    }
  }
});

console.log(response.output_text);
```

#### Python
```python
from openai import OpenAI
client = OpenAI()

response = client.responses.create(
    model="gpt-5",
    prompt={
        "id": "pmpt_abc123",
        "version": "2",
        "variables": {
            "customer_name": "Jane Doe",
            "product": "40oz juice box"
        }
    }
)

print(response.output_text)
```

#### cURL
```bash
curl https://api.openai.com/v1/responses   -H "Authorization: Bearer $OPENAI_API_KEY"   -H "Content-Type: application/json"   -d '{
    "model": "gpt-5",
    "prompt": {
      "id": "pmpt_abc123",
      "version": "2",
      "variables": {
        "customer_name": "Jane Doe",
        "product": "40oz juice box"
      }
    }
  }'
```

### B. Variables with file input

将已上传文件作为变量传入提示中。

#### JavaScript
```javascript
import fs from "fs";
import OpenAI from "openai";
const client = new OpenAI();

// 上传 PDF，将其引用在 prompt 变量中
const file = await client.files.create({
  file: fs.createReadStream("draconomicon.pdf"),
  purpose: "user_data",
});

const response = await client.responses.create({
  model: "gpt-5",
  prompt: {
    id: "pmpt_abc123",
    variables: {
      topic: "Dragons",
      reference_pdf: { type: "input_file", file_id: file.id }
    }
  }
});

console.log(response.output_text);
```

#### Python
```python
from openai import OpenAI
client = OpenAI()

# 上传 PDF，并在 prompt 变量中引用
file = client.files.create(
    file=open("draconomicon.pdf", "rb"),
    purpose="user_data",
)

response = client.responses.create(
    model="gpt-5",
    prompt={
        "id": "pmpt_abc123",
        "variables": {
            "topic": "Dragons",
            "reference_pdf": {
                "type": "input_file",
                "file_id": file.id
            }
        }
    }
)

print(response.output_text)
```

#### cURL
```bash
# 假设你已上传文件并获得 FILE_ID
curl https://api.openai.com/v1/responses   -H "Authorization: Bearer $OPENAI_API_KEY"   -H "Content-Type: application/json"   -d '{
    "model": "gpt-5",
    "prompt": {
      "id": "pmpt_abc123",
      "variables": {
        "topic": "Dragons",
        "reference_pdf": {
          "type": "input_file",
          "file_id": "file-abc123"
        }
      }
    }
  }'
```

---

## Next steps

- 在 Playground 中构建与迭代提示 → /chat/edit  
- 用 **Structured Outputs** 让模型输出严格 JSON → /docs/guides/structured-outputs  
- 查看 Responses API 完整参考 → /docs/api-reference/responses

---

*本页为你提供的原始内容的 Markdown 化与结构化整理版本。*
