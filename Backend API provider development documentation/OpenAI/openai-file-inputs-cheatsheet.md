# File inputs (PDF) — Quick Cheat Sheet

**What it is**
- Models with vision can read PDFs by ingesting **extracted text + a raster image of each page**. This captures tables/diagrams that aren’t in the text.

---

## Three ways to attach a PDF
1) **URL (no upload):**
```json
{
  "model": "gpt-5",
  "input": [{
    "role": "user",
    "content": [
      {"type": "input_text", "text": "Summarize key points."},
      {"type": "input_file", "file_url": "https://site.com/file.pdf"}
    ]
  }]
}
```

2) **File ID (upload first):**
```bash
# Upload
curl https://api.openai.com/v1/files   -H "Authorization: Bearer $OPENAI_API_KEY"   -F purpose="user_data"   -F file="@report.pdf"
```
```json
{
  "model": "gpt-5",
  "input": [{
    "role": "user",
    "content": [
      {"type": "input_file", "file_id": "file_ABC123"},
      {"type": "input_text", "text": "Extract action items."}
    ]
  }]
}
```

3) **Base64 (inline):**
```json
{
  "model": "gpt-5",
  "input": [{
    "role": "user",
    "content": [
      {
        "type": "input_file",
        "filename": "report.pdf",
        "file_data": "data:application/pdf;base64,<BASE64_BYTES>"
      },
      {"type": "input_text", "text": "List all tables with titles."}
    ]
  }]
}
```

---

## Minimal SDK snippets

**Python (URL):**
```python
from openai import OpenAI
client = OpenAI()
resp = client.responses.create(
  model="gpt-5",
  input=[{
    "role": "user",
    "content": [
      {"type":"input_text","text":"Summarize the figures."},
      {"type":"input_file","file_url":"https://site.com/file.pdf"}
    ]
  }]
)
print(resp.output_text)
```

**Node (File ID):**
```js
import fs from "fs";
import OpenAI from "openai";
const client = new OpenAI();

const file = await client.files.create({
  file: fs.createReadStream("report.pdf"),
  purpose: "user_data",
});

const resp = await client.responses.create({
  model: "gpt-5",
  input: [{
    role: "user",
    content: [
      { type: "input_file", file_id: file.id },
      { type: "input_text", text: "Give a concise executive summary." }
    ]
  }]
});
console.log(resp.output_text);
```

---

## Limits & requirements
- **Per-file size:** up to **10 MB**.  
- **Total request payload across files:** **≤ 32 MB**.  
- **Models:** use ones that accept **text + images** (e.g., *gpt-4o, gpt-4o-mini, o1*, or newer).
- **Purpose:** you can upload with any purpose, but **`user_data`** is recommended for files passed as inputs.

---

## Cost & performance tips
- **Every page image + extracted text** is added to context → more tokens. Large PDFs can be expensive.  
- Prefer **page-limited PDFs** or split large files; attach **only relevant pages**.  
- Be explicit in the prompt: “Focus on pages 3–6, especially the two tables.”  
- For repeat Q&A over many docs, consider **File Search / vector stores** instead of attaching entire PDFs per request.  
- For precise schema output, combine with **Structured Outputs** (JSON Schema / Pydantic / Zod).

---

## Prompt patterns
- **Summarization:** “Summarize the letter in 5 bullets. Include 3 risk factors and 3 opportunities.”  
- **Extraction:** “Return a JSON array of `{page, section, metric, value, unit}` from all tables titled ‘Revenue’ or ‘Sales’.”  
- **Figure emphasis:** “If a diagram contradicts the text, prefer the **diagram** and say where (page, figure).”  
- **Localization:** “Translate Section 2 into Spanish; keep original headings.”

---

## Common pitfalls (and fixes)
- **413 / payload too large:** Split the PDF or reduce pages; avoid attaching multiple big PDFs at once.  
- **OCR/scan quirks:** The model sees page **images**—ask it to rely on visuals when text extraction is poor.  
- **Base64 mistakes:** Include the **data URL prefix** (`data:application/pdf;base64,`).  
- **Sparse instructions:** PDFs are broad—**narrow scope** (pages, sections, targets) to cut cost and improve accuracy.

---

## Decision tree
- **One-off analysis of a small PDF?** Attach PDF directly via URL/File ID.  
- **Large or repeated queries across many PDFs?** Use **File Search**.  
- **Need tables/figures copied verbatim?** Ask for **page/figure refs** and **machine-readable** (CSV/JSON).  
- **Strict structure for UI/backend?** Use **Structured Outputs**.

---

## Quick test prompts
- “Read the attached PDF. Output a CSV with columns `page,title,subtitle,key_numbers`.”  
- “Extract all deadlines and deliverables with due date (ISO 8601), owner, and page.”  
- “Summarize only the **‘Management Discussion’** section; max 150 words.”

---

*Keep PDFs tight, prompts specific, and outputs structured when possible.*
