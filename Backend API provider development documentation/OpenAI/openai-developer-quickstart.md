<!-- File: openai-developer-quickstart.md -->
# Developer quickstart

**Source:** https://platform.openai.com/docs/quickstart

OpenAI API 提供统一的接口来调用文本生成、自然语言处理、计算机视觉等模型。下面整理为纯净 Markdown，去除了侧边栏与杂项，仅保留关键开发文档内容与示例代码。

---

## Generate text from a model

生成一条简短文本。

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

> 环境准备：安装并配置官方 SDK 以运行上述代码（/docs/libraries）。
> 入门模板：https://github.com/openai/openai-responses-starter-app
> 提示工程：/docs/guides/text

---

## Analyze images and files

支持将图像 URL、文件 URL 或上传的 PDF 文档直接作为输入，用于抽取文本、分类内容或检测视觉要素。

### 1) Image URL — 分析图像内容

#### JavaScript
```javascript
import OpenAI from "openai";
const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-5",
  input: [
    {
      role: "user",
      content: [
        { type: "input_text", text: "What is in this image?" },
        {
          type: "input_image",
          image_url: "https://openai-documentation.vercel.app/images/cat_and_otter.png",
        },
      ],
    },
  ],
});

console.log(response.output_text);
```

#### cURL
```bash
curl "https://api.openai.com/v1/responses"   -H "Content-Type: application/json"   -H "Authorization: Bearer $OPENAI_API_KEY"   -d '{
    "model": "gpt-5",
    "input": [
      {
        "role": "user",
        "content": [
          { "type": "input_text", "text": "What is in this image?" },
          {
            "type": "input_image",
            "image_url": "https://openai-documentation.vercel.app/images/cat_and_otter.png"
          }
        ]
      }
    ]
  }'
```

#### Python
```python
from openai import OpenAI
client = OpenAI()

response = client.responses.create(
    model="gpt-5",
    input=[
        {
            "role": "user",
            "content": [
                {
                    "type": "input_text",
                    "text": "What teams are playing in this image?",
                },
                {
                    "type": "input_image",
                    "image_url": "https://upload.wikimedia.org/wikipedia/commons/3/3b/LeBron_James_Layup_%28Cleveland_vs_Brooklyn_2018%29.jpg"
                }
            ]
        }
    ]
)

print(response.output_text)
```

### 2) File URL — 使用远程文件作为输入

#### cURL
```bash
curl "https://api.openai.com/v1/responses"   -H "Content-Type: application/json"   -H "Authorization: Bearer $OPENAI_API_KEY"   -d '{
    "model": "gpt-5",
    "input": [
      {
        "role": "user",
        "content": [
          { "type": "input_text",
            "text": "Analyze the letter and provide a summary of the key points."
          },
          {
            "type": "input_file",
            "file_url": "https://www.berkshirehathaway.com/letters/2024ltr.pdf"
          }
        ]
      }
    ]
  }'
```

#### JavaScript
```javascript
import OpenAI from "openai";
const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-5",
  input: [
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: "Analyze the letter and provide a summary of the key points.",
        },
        {
          type: "input_file",
          file_url: "https://www.berkshirehathaway.com/letters/2024ltr.pdf",
        },
      ],
    },
  ],
});

console.log(response.output_text);
```

#### Python
```python
from openai import OpenAI
client = OpenAI()

response = client.responses.create(
    model="gpt-5",
    input=[
        {
            "role": "user",
            "content": [
                {
                    "type": "input_text",
                    "text": "Analyze the letter and provide a summary of the key points.",
                },
                {
                    "type": "input_file",
                    "file_url": "https://www.berkshirehathaway.com/letters/2024ltr.pdf",
                },
            ],
        },
    ]
)

print(response.output_text)
```

### 3) Upload file — 上传文件并引用

#### cURL
```bash
# 先上传文件
curl https://api.openai.com/v1/files   -H "Authorization: Bearer $OPENAI_API_KEY"   -F purpose="user_data"   -F file="@draconomicon.pdf"

# 在对话中以 file_id 引用
curl "https://api.openai.com/v1/responses"   -H "Content-Type: application/json"   -H "Authorization: Bearer $OPENAI_API_KEY"   -d '{
    "model": "gpt-5",
    "input": [
      {
        "role": "user",
        "content": [
          { "type": "input_file", "file_id": "file-6F2ksmvXxt4VdoqmHRw6kL" },
          { "type": "input_text", "text": "What is the first dragon in the book?" }
        ]
      }
    ]
  }'
```

#### JavaScript
```javascript
import fs from "fs";
import OpenAI from "openai";
const client = new OpenAI();

const file = await client.files.create({
  file: fs.createReadStream("draconomicon.pdf"),
  purpose: "user_data",
});

const response = await client.responses.create({
  model: "gpt-5",
  input: [
    {
      role: "user",
      content: [
        { type: "input_file", file_id: file.id },
        { type: "input_text", text: "What is the first dragon in the book?" },
      ],
    },
  ],
});

console.log(response.output_text);
```

#### Python
```python
from openai import OpenAI
client = OpenAI()

file = client.files.create(
    file=open("draconomicon.pdf", "rb"),
    purpose="user_data"
)

response = client.responses.create(
    model="gpt-5",
    input=[
        {
            "role": "user",
            "content": [
                { "type": "input_file", "file_id": file.id },
                { "type": "input_text", "text": "What is the first dragon in the book?" }
            ]
        }
    ]
)

print(response.output_text)
```

> 进一步阅读：图像输入（/docs/guides/images），文件与 PDF（/docs/guides/pdf-files）。

---

## Extend the model with tools

为模型接入外部数据与函数。可用内置工具（Web 搜索、文件检索），也可定义自有函数或远程 MCP 服务器。

### Web search — 在响应中调用联网搜索

#### JavaScript
```javascript
import OpenAI from "openai";
const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-5",
  tools: [{ type: "web_search_preview" }],
  input: "What was a positive news story from today?",
});

console.log(response.output_text);
```

#### Python
```python
from openai import OpenAI
client = OpenAI()

response = client.responses.create(
    model="gpt-5",
    tools=[{"type": "web_search_preview"}],
    input="What was a positive news story from today?"
)

print(response.output_text)
```

#### cURL
```bash
curl "https://api.openai.com/v1/responses"   -H "Content-Type: application/json"   -H "Authorization: Bearer $OPENAI_API_KEY"   -d '{
    "model": "gpt-5",
    "tools": [{"type": "web_search_preview"}],
    "input": "what was a positive news story from today?"
  }'
```

### File search — 在响应中检索你的文件

#### Python
```python
from openai import OpenAI
client = OpenAI()

response = client.responses.create(
    model="gpt-4.1",
    input="What is deep research by OpenAI?",
    tools=[{
        "type": "file_search",
        "vector_store_ids": ["<vector_store_id>"]
    }]
)
print(response)
```

#### JavaScript
```javascript
import OpenAI from "openai";
const openai = new OpenAI();

const response = await openai.responses.create({
  model: "gpt-4.1",
  input: "What is deep research by OpenAI?",
  tools: [
    {
      type: "file_search",
      vector_store_ids: ["<vector_store_id>"],
    },
  ],
});
console.log(response);
```

### Function calling — 让模型调用你的函数

#### JavaScript
```javascript
import OpenAI from "openai";
const client = new OpenAI();

const tools = [
  {
    type: "function",
    name: "get_weather",
    description: "Get current temperature for a given location.",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "City and country e.g. Bogotá, Colombia",
        },
      },
      required: ["location"],
      additionalProperties: false,
    },
    strict: true,
  },
];

const response = await client.responses.create({
  model: "gpt-5",
  input: [
    { role: "user", content: "What is the weather like in Paris today?" },
  ],
  tools,
});

console.log(response.output[0].to_json());
```

#### Python
```python
from openai import OpenAI

client = OpenAI()

tools = [
    {
        "type": "function",
        "name": "get_weather",
        "description": "Get current temperature for a given location.",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "City and country e.g. Bogotá, Colombia",
                }
            },
            "required": ["location"],
            "additionalProperties": False,
        },
        "strict": True,
    },
]

response = client.responses.create(
    model="gpt-5",
    input=[
        {"role": "user", "content": "What is the weather like in Paris today?"},
    ],
    tools=tools,
)

print(response.output[0].to_json())
```

#### cURL
```bash
curl -X POST https://api.openai.com/v1/responses   -H "Authorization: Bearer $OPENAI_API_KEY"   -H "Content-Type: application/json"   -d '{
    "model": "gpt-5",
    "input": [
      {"role": "user", "content": "What is the weather like in Paris today?"}
    ],
    "tools": [
      {
        "type": "function",
        "name": "get_weather",
        "description": "Get current temperature for a given location.",
        "parameters": {
          "type": "object",
          "properties": {
            "location": {
              "type": "string",
              "description": "City and country e.g. Bogotá, Colombia"
            }
          },
          "required": ["location"],
          "additionalProperties": false
        },
        "strict": true
      }
    ]
  }'
```

### Remote MCP — 调用远程 MCP 服务器

#### cURL
```bash
curl https://api.openai.com/v1/responses   -H "Content-Type: application/json"   -H "Authorization: Bearer $OPENAI_API_KEY"   -d '{
    "model": "gpt-5",
    "tools": [
      {
        "type": "mcp",
        "server_label": "dmcp",
        "server_description": "A Dungeons and Dragons MCP server to assist with dice rolling.",
        "server_url": "https://dmcp-server.deno.dev/sse",
        "require_approval": "never"
      }
    ],
    "input": "Roll 2d4+1"
  }'
```

#### JavaScript
```javascript
import OpenAI from "openai";
const client = new OpenAI();

const resp = await client.responses.create({
  model: "gpt-5",
  tools: [
    {
      type: "mcp",
      server_label: "dmcp",
      server_description: "A Dungeons and Dragons MCP server to assist with dice rolling.",
      server_url: "https://dmcp-server.deno.dev/sse",
      require_approval: "never",
    },
  ],
  input: "Roll 2d4+1",
});

console.log(resp.output_text);
```

#### Python
```python
from openai import OpenAI

client = OpenAI()

resp = client.responses.create(
    model="gpt-5",
    tools=[
        {
            "type": "mcp",
            "server_label": "dmcp",
            "server_description": "A Dungeons and Dragons MCP server to assist with dice rolling.",
            "server_url": "https://dmcp-server.deno.dev/sse",
            "require_approval": "never",
        },
    ],
    input="Roll 2d4+1",
)

print(resp.output_text)
```

> 更多工具：/docs/guides/tools；函数调用：/docs/guides/function-calling。

---

## Stream responses and build realtime apps

使用服务端事件（SSE）边生成边返回；或采用 Realtime API 构建交互式语音/多模态应用。

### SSE 流式事件

#### JavaScript
```javascript
import { OpenAI } from "openai";
const client = new OpenAI();

const stream = await client.responses.create({
  model: "gpt-5",
  input: [
    {
      role: "user",
      content: "Say 'double bubble bath' ten times fast.",
    },
  ],
  stream: true,
});

for await (const event of stream) {
  console.log(event);
}
```

#### Python
```python
from openai import OpenAI
client = OpenAI()

stream = client.responses.create(
    model="gpt-5",
    input=[
        {
            "role": "user",
            "content": "Say 'double bubble bath' ten times fast.",
        },
    ],
    stream=True,
)

for event in stream:
    print(event)
```

> 参考：/docs/guides/streaming-responses（SSE）、/docs/guides/realtime（Realtime API）。

---

## Build agents

用 OpenAI 平台构建可代表用户执行操作的 Agents。使用 Python 或 TypeScript 的 Agents SDK 在后端编排。

### 语言分诊（triage）Agent 示例

#### TypeScript / JavaScript
```javascript
import { Agent, run } from '@openai/agents';

const spanishAgent = new Agent({
  name: 'Spanish agent',
  instructions: 'You only speak Spanish.',
});

const englishAgent = new Agent({
  name: 'English agent',
  instructions: 'You only speak English',
});

const triageAgent = new Agent({
  name: 'Triage agent',
  instructions:
      'Handoff to the appropriate agent based on the language of the request.',
  handoffs: [spanishAgent, englishAgent],
});

const result = await run(triageAgent, 'Hola, ¿cómo estás?');
console.log(result.finalOutput);
```

#### Python
```python
from agents import Agent, Runner
import asyncio

spanish_agent = Agent(
    name="Spanish agent",
    instructions="You only speak Spanish.",
)

english_agent = Agent(
    name="English agent",
    instructions="You only speak English",
)

triage_agent = Agent(
    name="Triage agent",
    instructions="Handoff to the appropriate agent based on the language of the request.",
    handoffs=[spanish_agent, english_agent],
)


async def main():
    result = await Runner.run(triage_agent, input="Hola, ¿cómo estás?")
    print(result.final_output)


if __name__ == "__main__":
    asyncio.run(main())
```