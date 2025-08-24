# Web search

Allow models to search the web for the latest information before generating a response.

Using the **Responses API**, you can enable web search by configuring it in the `tools` array in an API request. Like any other tool, the model can choose to search the web or not based on the content of the input prompt.

---

## Web search tool example

**JavaScript**

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

**Python**

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

**curl**

```bash
curl "https://api.openai.com/v1/responses"   -H "Content-Type: application/json"   -H "Authorization: Bearer $OPENAI_API_KEY"   -d '{
        "model": "gpt-5",
        "tools": [{"type": "web_search_preview"}],
        "input": "what was a positive news story from today?"
  }'
```

---

## Web search tool versions

- **Default alias:** `web_search_preview`
- **Current snapshot:** `web_search_preview_2025_03_11`

As the tool evolves, future dated snapshot versions will be documented in the API reference.

You can force usage via `tool_choice`:

```json
{
  "tool_choice": { "type": "web_search_preview" }
}
```

This can help ensure lower latency and more consistent results.

---

## Output and citations

Model responses that **use the web search tool** will include two parts:

1. A `web_search_call` output item with the ID of the search call, along with the action taken in `web_search_call.action`. Actions can be:
   - `search` — a web search (usually includes the query/domains). *Search actions incur a tool call cost; see pricing.*
   - `open_page` — a page being opened. *(Deep Research models only.)*
   - `find_in_page` — find within a page. *(Deep Research models only.)*
2. A `message` output item containing:
   - The text result in `message.content[0].text`
   - Inline citations in `message.content[0].annotations` with `type: "url_citation"`

> **UI requirement:** When displaying web results or information from web results, **inline citations must be clearly visible and clickable**.

**Example output (truncated):**

```json
[
  {
    "type": "web_search_call",
    "id": "ws_67c9fa0502748190b7dd390736892e100be649c1a5ff9609",
    "status": "completed"
  },
  {
    "id": "msg_67c9fa077e288190af08fdffda2e34f20be649c1a5ff9609",
    "type": "message",
    "status": "completed",
    "role": "assistant",
    "content": [
      {
        "type": "output_text",
        "text": "On March 6, 2025, several news...",
        "annotations": [
          {
            "type": "url_citation",
            "start_index": 2606,
            "end_index": 2758,
            "url": "https://...",
            "title": "Title..."
          }
        ]
      }
    ]
  }
]
```

---

## User location

To refine search results based on geography, specify an **approximate** user location using `country`, `city`, `region`, and/or `timezone`.

- `city` and `region` are free text (e.g., `"Minneapolis"`, `"Minnesota"`).
- `country` is a 2-letter ISO code (e.g., `"US"`).
- `timezone` is an IANA zone (e.g., `"America/Chicago"`).

> **Note:** User location is **not supported** for deep research models using web search.

**Python**

```python
from openai import OpenAI
client = OpenAI()

response = client.responses.create(
    model="o4-mini",
    tools=[{
        "type": "web_search_preview",
        "user_location": {
            "type": "approximate",
            "country": "GB",
            "city": "London",
            "region": "London"
        }
    }],
    input="What are the best restaurants around Granary Square?",
)

print(response.output_text)
```

**JavaScript**

```javascript
import OpenAI from "openai";
const openai = new OpenAI();

const response = await openai.responses.create({
  model: "o4-mini",
  tools: [{
    type: "web_search_preview",
    user_location: {
      type: "approximate",
      country: "GB",
      city: "London",
      region: "London"
    }
  }],
  input: "What are the best restaurants around Granary Square?",
});

console.log(response.output_text);
```

**curl**

```bash
curl "https://api.openai.com/v1/responses"   -H "Content-Type: application/json"   -H "Authorization: Bearer $OPENAI_API_KEY"   -d '{
    "model": "o4-mini",
    "tools": [{
      "type": "web_search_preview",
      "user_location": {
        "type": "approximate",
        "country": "GB",
        "city": "London",
        "region": "London"
      }
    }],
    "input": "What are the best restaurants around Granary Square?"
  }'
```

---

## Search context size

When using this tool, `search_context_size` controls **how much external web content** is retrieved to help formulate a response. These tokens:

- **Do not** count against your main model’s context window
- **Are not** carried over between turns (they’re used and then discarded)

**Tradeoffs**

- **Cost:** Search content tokens are free for some models, but for others are billed at text token rates (see pricing).
- **Quality:** Higher context sizes generally yield richer, more accurate answers.
- **Latency:** Higher sizes process more tokens, increasing response time.

**Allowed values**

- `high` — most context, slowest
- `medium` *(default)* — balanced
- `low` — least context, fastest

> Not supported for `o3`, `o3-pro`, `o4-mini`, and deep research models.

**Python**

```python
from openai import OpenAI
client = OpenAI()

response = client.responses.create(
    model="gpt-4.1",
    tools=[{
        "type": "web_search_preview",
        "search_context_size": "low"
    }],
    input="What movie won best picture in 2025?",
)

print(response.output_text)
```

**JavaScript**

```javascript
import OpenAI from "openai";
const openai = new OpenAI();

const response = await openai.responses.create({
  model: "gpt-4.1",
  tools: [{
    type: "web_search_preview",
    search_context_size: "low"
  }],
  input: "What movie won best picture in 2025?",
});

console.log(response.output_text);
```

**curl**

```bash
curl "https://api.openai.com/v1/responses"   -H "Content-Type: application/json"   -H "Authorization: Bearer $OPENAI_API_KEY"   -d '{
    "model": "gpt-4.1",
    "tools": [{
      "type": "web_search_preview",
      "search_context_size": "low"
    }],
    "input": "What movie won best picture in 2025?"
  }'
```

---

## Usage notes

- **API availability:** Responses, Chat Completions, and Assistants (subject to the underlying model’s tiered rate limits).
- **Pricing:** See the pricing page for search tool call costs and any model-specific token pricing.
- **Zero Data Retention & Data Residency (ZDR):** Refer to the platform data handling docs.

### Limitations

- Not supported on `gpt-4.1-nano`.
- `gpt-4o-search-preview` and `gpt-4o-mini-search-preview` (Chat Completions) support a subset of parameters—see each model’s data page.
- When used as a tool in the Responses API, web search shares the same **tiered rate limits** as the selected model.
- Web search tool context window limit: **128,000 tokens** (even with `gpt-4.1` / `gpt-4.1-mini`).
- See documentation for data handling, residency, and retention specifics.

---

*End of page.*
