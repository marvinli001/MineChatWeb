# Code Interpreter
Allow models to write and run Python to solve problems.

The **Code Interpreter** tool lets models write and run Python code in a sandboxed environment to solve complex problems across data analysis, coding, math, and image processing. Use it for:

- Processing files with diverse data and formatting  
- Generating files (e.g., CSVs, images of graphs)  
- Iteratively writing & running code until it succeeds  
- Boosting visual intelligence in reasoning models (e.g., o3, o4-mini) by allowing cropping, zooming, rotating, and other image transforms

---

## Quick start — Use the Responses API with Code Interpreter

**cURL**
```bash
curl https://api.openai.com/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-4.1",
    "tools": [{
      "type": "code_interpreter",
      "container": { "type": "auto" }
    }],
    "instructions": "You are a personal math tutor. When asked a math question, write and run code using the python tool to answer the question.",
    "input": "I need to solve the equation 3x + 11 = 14. Can you help me?"
  }'
```

**JavaScript**
```js
import OpenAI from "openai";
const client = new OpenAI();

const instructions = `
You are a personal math tutor. When asked a math question, 
write and run code using the python tool to answer the question.
`;

const resp = await client.responses.create({
  model: "gpt-4.1",
  tools: [
    {
      type: "code_interpreter",
      container: { type: "auto" },
    },
  ],
  instructions,
  input: "I need to solve the equation 3x + 11 = 14. Can you help me?",
});

console.log(JSON.stringify(resp.output, null, 2));
```

**Python**
```python
from openai import OpenAI

client = OpenAI()

instructions = """
You are a personal math tutor. When asked a math question, 
write and run code using the python tool to answer the question.
"""

resp = client.responses.create(
    model="gpt-4.1",
    tools=[
        {
            "type": "code_interpreter",
            "container": {"type": "auto"}
        }
    ],
    instructions=instructions,
    input="I need to solve the equation 3x + 11 = 14. Can you help me?",
)

print(resp.output)
```

> **Note:** While we call this tool *Code Interpreter*, the model knows it as the **python tool**. Prompts that explicitly ask to use “the python tool” are the most reliable.

---

## Containers
The Code Interpreter tool runs inside a **container**: a fully sandboxed VM where Python executes. Containers can include files you upload or files the model generates.

There are two ways to create containers:

### 1) Auto mode (recommended)
Pass `"container": { "type": "auto", "file_ids": [...] }` in the tool config. The API automatically creates or reuses a container used by a previous `code_interpreter_call` in context. The response will include the `container_id` for reference.

### 2) Explicit mode
Create a container first, then use its ID.

**cURL**
```bash
# Create a container
curl https://api.openai.com/v1/containers \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "name": "My Container"
      }'

# Use the returned container id in a responses call
curl https://api.openai.com/v1/responses \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4.1",
    "tools": [{
      "type": "code_interpreter",
      "container": "cntr_abc123"
    }],
    "tool_choice": "required",
    "input": "use the python tool to calculate what is 4 * 3.82. and then find its square root and then find the square root of that result"
  }'
```

**Python**
```python
from openai import OpenAI
client = OpenAI()

container = client.containers.create(name="test-container")

response = client.responses.create(
    model="gpt-4.1",
    tools=[{
        "type": "code_interpreter",
        "container": container.id
    }],
    tool_choice="required",
    input="use the python tool to calculate what is 4 * 3.82. and then find its square root and then find the square root of that result"
)

print(response.output_text)
```

**JavaScript**
```js
import OpenAI from "openai";
const client = new OpenAI();

const container = await client.containers.create({ name: "test-container" });

const resp = await client.responses.create({
    model: "gpt-4.1",
    tools: [
      {
        type: "code_interpreter",
        container: container.id
      }
    ],
    tool_choice: "required",
    input: "use the python tool to calculate what is 4 * 3.82. and then find its square root and then find the square root of that result"
});

console.log(resp.output_text);
```

> Containers created in auto mode are also visible via the `/v1/containers` endpoint.

### Expiration
Treat containers as **ephemeral** and store needed data in your own systems.
- A container **expires after 20 minutes** of inactivity. After expiry, `/v1/responses` calls using it will fail; you can still retrieve metadata, but **all container data are discarded** and unrecoverable.  
- You **cannot** reactivate an expired container; create a new one and re-upload files. In‑memory state (e.g., Python objects) is lost.  
- Any container operation (retrieve, add/delete files) refreshes its `last_active_at` timestamp.

---

## Working with files
When using Code Interpreter, the model can **create files** (plots, CSVs, transformed images, etc.) directly in the container. It cites these files via **annotations** on its next message.

Example `message` with file citation (truncated):

```json
{
  "id": "msg_...",
  "content": [
    {
      "annotations": [
        {
          "file_id": "cfile_682d514b2e00819184b9b07e13557f82",
          "index": null,
          "type": "container_file_citation",
          "container_id": "cntr_...",
          "end_index": 0,
          "filename": "cfile_682d514b2e00819184b9b07e13557f82.png",
          "start_index": 0
        }
      ],
      "text": "Here is the histogram of the RGB channels for the uploaded image...",
      "type": "output_text",
      "logprobs": []
    }
  ],
  "role": "assistant",
  "status": "completed",
  "type": "message"
}
```

### Downloading generated files
Use **Retrieve container file content** to download bytes. Files referenced in annotations use type `container_file_citation` with `container_id`, `file_id`, and `filename`—parse and surface them as links in your UI.

### Uploading files
- Add files with **Create container file** (multipart upload or by `file_id`).  
- List with **List container files**.  
- Download with **Retrieve container file content**.  
- Any files in model **input** are automatically uploaded to the container.

---

## Supported file types

| Extension | MIME type |
|---|---|
| .c | text/x-c |
| .cs | text/x-csharp |
| .cpp | text/x-c++ |
| .csv | text/csv |
| .doc | application/msword |
| .docx | application/vnd.openxmlformats-officedocument.wordprocessingml.document |
| .html | text/html |
| .java | text/x-java |
| .json | application/json |
| .md | text/markdown |
| .pdf | application/pdf |
| .php | text/x-php |
| .pptx | application/vnd.openxmlformats-officedocument.presentationml.presentation |
| .py | text/x-python |
| .py | text/x-script.python |
| .rb | text/x-ruby |
| .tex | text/x-tex |
| .txt | text/plain |
| .css | text/css |
| .js | text/javascript |
| .sh | application/x-sh |
| .ts | application/typescript |
| .csv | application/csv |
| .jpeg | image/jpeg |
| .jpg | image/jpeg |
| .gif | image/gif |
| .pkl | application/octet-stream |
| .png | image/png |
| .tar | application/x-tar |
| .xlsx | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet |
| .xml | application/xml or text/xml |
| .zip | application/zip |

> Note: Some extensions (like `.csv`) may have multiple MIME types depending on context.

---

## Usage notes

### API availability & rate limits
- Responses / Chat Completions / Assistants: **100 RPM per org** (subject to change—check model pages).

### Pricing, data handling & residency
- See **Pricing**, **Zero-Data Retention (ZDR)**, and **Data residency** docs for details.

---

### Tips
- Prefer **auto containers** for simplicity; switch to explicit containers to carry state across steps you orchestrate.  
- Always **download needed outputs** before the container expires.  
- In prompts, explicitly say: *“Use the python tool and show your work in code; then run it.”*  
- Parse **file citations** to let users download generated plots, tables, and reports.
