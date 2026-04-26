# Nova Worker — LLM-Powered

Nova Hermes — Writer / Admin / Researcher for HAMH. Now powered by a real LLM backend.

## Capabilities

| Type | Description |
|------|-------------|
| `writing` | Blogs, copy, emails, ebooks, guides, product descriptions |
| `research` | Market research, competitive analysis, data gathering |
| `summarization` | Summarize articles, reports, documents |
| `content-creation` | Draft social content, newsletters, sales copy |
| `editing` | Proofread, rewrite, tone adjustment |
| `fact-check` | Verify claims, sources, data |
| `admin` | Reports, data organization, documentation |

## Environment Variables

### Required

```bash
HAMH_BASE_URL=https://hamh.oddsifylabs.com
API_KEY=your_hamh_api_key
LLM_API_KEY=your_llm_api_key
```

### Optional (LLM Tuning)

```bash
LLM_BASE_URL=https://api.openai.com/v1    # or https://api.moonshot.cn/v1 for Kimi
LLM_MODEL=gpt-4o-mini                      # or gpt-4o, moonshot-v1-8k, etc.
LLM_TIMEOUT_MS=60000
```

### Full Example

```bash
# HAMH connection
HAMH_BASE_URL=https://hamh.oddsifylabs.com
API_KEY=your_hamh_key

# LLM provider (OpenAI example)
LLM_API_KEY=sk-...
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini

# Or Moonshot / Kimi
LLM_API_KEY=sk-...
LLM_BASE_URL=https://api.moonshot.cn/v1
LLM_MODEL=moonshot-v1-8k

# Polling
POLL_INTERVAL_MS=30000
```

## Supported LLM Providers

Any OpenAI-compatible API:
- **OpenAI** (`https://api.openai.com/v1`)
- **Moonshot AI / Kimi** (`https://api.moonshot.cn/v1`)
- **Groq** (`https://api.groq.com/openai/v1`)
- **Local** (`http://localhost:1234/v1` for LM Studio, etc.)

## Task Parameters

Tasks can include `parameters` for fine-grained control:

```json
{
  "type": "writing",
  "description": "Blog post about AI agents",
  "parameters": {
    "tone": "professional",
    "format": "blog post",
    "length": "medium",
    "maxTokens": 2000
  }
}
```

## Commands

```bash
@nova write blog post about AI automation trends
@nova research competitors in AI agent space
@nova summarize https://arxiv.org/abs/2301.00001
@nova draft sales email for Oddsify Labs ebook
@nova edit product description for messaging bots
@nova fact-check claim about AI replacing jobs
@nova admin compile weekly report
```

## Deployment

### Railway (recommended)

1. Create new service from `nova-worker/` folder
2. Set `HAMH_BASE_URL`, `API_KEY`, and `LLM_API_KEY`
3. Optionally set `LLM_BASE_URL` and `LLM_MODEL`
4. Deploy

### Local / VPS

```bash
cd nova-worker
npm install
HAMH_BASE_URL=https://hamh.oddsifylabs.com API_KEY=*** LLM_API_KEY=*** npm start
```

### Systemd Service

```bash
sudo cp nova-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable nova-worker
sudo systemctl start nova-worker
```
