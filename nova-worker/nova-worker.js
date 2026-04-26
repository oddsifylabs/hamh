#!/usr/bin/env node

/**
 * NOVA WORKER — LLM-POWERED
 * Hermes Agent Management Hub — Writer / Admin / Researcher
 * Oddsify Labs
 *
 * Capabilities:
 * - writing: blogs, copy, emails, ebooks, guides, product descriptions
 * - research: market research, competitive analysis, data gathering
 * - summarization: summarize articles, reports, documents
 * - content-creation: draft social content, newsletters, sales copy
 * - editing: proofread, rewrite, tone adjustment
 * - fact-check: verify claims, sources, data
 * - admin: reports, data organization, documentation
 *
 * LLM Provider: OpenAI-compatible API (OpenAI, Moonshot/Kimi, Groq, etc.)
 */

const axios = require('axios');

// ============================================
// CONFIG
// ============================================
const HAMH_BASE_URL = process.env.HAMH_BASE_URL || 'https://hamh.oddsifylabs.com';
const API_KEY = process.env.API_KEY || process.env.HAMH_API_KEY;
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS, 10) || 30000;
const AGENT_ID = 'nova';

// LLM config
const LLM_API_KEY = process.env.LLM_API_KEY;
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';
const LLM_TIMEOUT = parseInt(process.env.LLM_TIMEOUT_MS, 10) || 60000;

if (!API_KEY) {
  console.error('[Nova] FATAL: API_KEY (HAMH) environment variable required');
  process.exit(1);
}

if (!LLM_API_KEY) {
  console.error('[Nova] FATAL: LLM_API_KEY environment variable required');
  console.error('[Nova] Set LLM_API_KEY and optionally LLM_BASE_URL + LLM_MODEL');
  process.exit(1);
}

const api = axios.create({
  baseURL: HAMH_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
  },
  timeout: 30000,
});

const llm = axios.create({
  baseURL: LLM_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${LLM_API_KEY}`,
  },
  timeout: LLM_TIMEOUT,
});

function log(level, message) {
  const ts = new Date().toISOString();
  const icon = { info: '📜', task: '✍️', complete: '✅', error: '❌', warn: '⚠️', llm: '🤖' }[level] || '•';
  console.log(`[${ts}] ${icon} [Nova] ${message}`);
}

// ============================================
// LLM CLIENT
// ============================================

async function callLLM(systemPrompt, userPrompt, options = {}) {
  const maxTokens = options.maxTokens || 2000;
  const temperature = options.temperature ?? 0.7;

  log('llm', `Calling ${LLM_MODEL}...`);
  const start = Date.now();

  try {
    const { data } = await llm.post('/chat/completions', {
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature,
    });

    const latency = Date.now() - start;
    const choice = data.choices?.[0];
    const content = choice?.message?.content?.trim() || '';
    const tokens = {
      prompt: data.usage?.prompt_tokens || 0,
      completion: data.usage?.completion_tokens || 0,
      total: data.usage?.total_tokens || 0,
    };

    log('llm', `Response in ${latency}ms | ${tokens.total} tokens`);
    return { content, tokens, latency, success: true };
  } catch (error) {
    const latency = Date.now() - start;
    const msg = error.response?.data?.error?.message || error.message;
    log('error', `LLM failed (${latency}ms): ${msg}`);
    return { content: '', tokens: { total: 0 }, latency, success: false, error: msg };
  }
}

// ============================================
// SYSTEM PROMPTS BY TASK TYPE
// ============================================

const SYSTEM_PROMPTS = {
  writing: `You are Nova Hermes, the senior writer at Oddsify Labs. You produce polished, professional content.
Rules:
- Match the tone requested (technical, casual, persuasive, etc.)
- Use clear structure: headings, bullet points, short paragraphs
- Include a compelling hook and strong conclusion
- Optimize for the target platform (blog, email, product page, etc.)`,

  research: `You are Nova Hermes, the research lead at Oddsify Labs. You gather and synthesize information rigorously.
Rules:
- Provide structured findings with clear categories
- Cite sources where possible
- Highlight key insights, trends, and actionable takeaways
- Note any gaps or areas needing further investigation
- Be objective and data-driven`,

  summarization: `You are Nova Hermes, the summarization specialist at Oddsify Labs. You distill complex information into clear, concise summaries.
Rules:
- Capture the core message without losing critical details
- Use bullet points for key points
- Include a 1-sentence executive summary at the top
- Note any action items or decisions implied by the text`,

  'content-creation': `You are Nova Hermes, the content strategist at Oddsify Labs. You create engaging content for social media, newsletters, and marketing.
Rules:
- Match the platform's style and constraints (character limits, hashtags, etc.)
- Use engaging hooks and clear calls-to-action
- Include relevant hashtags or mentions if appropriate
- Maintain brand voice: knowledgeable, approachable, cutting-edge`,

  editing: `You are Nova Hermes, the editor at Oddsify Labs. You improve clarity, grammar, tone, and structure.
Rules:
- Preserve the author's original intent and voice
- Fix grammar, spelling, and punctuation
- Improve sentence flow and readability
- Suggest structural improvements if needed
- Provide a brief summary of changes made`,

  'fact-check': `You are Nova Hermes, the fact-checker at Oddsify Labs. You verify claims with rigor.
Rules:
- Evaluate each claim as: VERIFIED, PARTIALLY TRUE, UNVERIFIED, or FALSE
- Provide reasoning for each evaluation
- Suggest authoritative sources where relevant
- Flag any potentially misleading phrasing
- Be conservative: if you cannot verify, say UNVERIFIED`,

  admin: `You are Nova Hermes, the admin assistant at Oddsify Labs. You produce clear, structured reports and documentation.
Rules:
- Use clear formatting: tables, lists, sections
- Be concise but comprehensive
- Include dates, metrics, and status indicators
- Suggest next steps or action items where appropriate`,

  custom: `You are Nova Hermes, a versatile AI assistant at Oddsify Labs. You handle a wide range of tasks with professionalism and care.
Rules:
- Ask clarifying questions if the task is ambiguous
- Provide structured, actionable output
- Be thorough but concise`,
};

// ============================================
// TASK HANDLERS
// ============================================

const HANDLERS = {
  async writing(task) {
    const prompt = task.parameters?.prompt || task.description;
    const tone = task.parameters?.tone || 'professional';
    const format = task.parameters?.format || 'blog post';
    const length = task.parameters?.length || 'medium';

    const userPrompt = `Task: ${prompt}
Format: ${format}
Tone: ${tone}
Length: ${length}

Write the content now. Be specific and actionable.`;

    const result = await callLLM(SYSTEM_PROMPTS.writing, userPrompt, {
      temperature: 0.8,
      maxTokens: task.parameters?.maxTokens || 2000,
    });

    if (!result.success) throw new Error(result.error);
    return {
      text: result.content,
      meta: { tone, format, length },
      tokens: result.tokens,
    };
  },

  async research(task) {
    const topic = task.parameters?.topic || task.description;
    const depth = task.parameters?.depth || 'comprehensive';

    const userPrompt = `Research task: ${topic}
Depth: ${depth}

Provide structured findings including:
1. Executive summary
2. Key findings (bullet points)
3. Trends and patterns
4. Actionable insights
5. Recommended next steps
6. Gaps or uncertainties`;

    const result = await callLLM(SYSTEM_PROMPTS.research, userPrompt, {
      temperature: 0.5,
      maxTokens: 3000,
    });

    if (!result.success) throw new Error(result.error);
    return {
      text: result.content,
      meta: { topic, depth },
      tokens: result.tokens,
    };
  },

  async summarization(task) {
    const text = task.parameters?.text || task.description;
    const style = task.parameters?.style || 'concise';

    const userPrompt = `Summarize the following content. Style: ${style}

---
${text}
---

Provide:
1. One-sentence executive summary
2. Key points (bullets)
3. Any implied action items`;

    const result = await callLLM(SYSTEM_PROMPTS.summarization, userPrompt, {
      temperature: 0.3,
      maxTokens: 1500,
    });

    if (!result.success) throw new Error(result.error);
    return {
      text: result.content,
      meta: { style, originalLength: text.length },
      tokens: result.tokens,
    };
  },

  async 'content-creation'(task) {
    const prompt = task.parameters?.prompt || task.description;
    const platform = task.parameters?.platform || 'general';

    const userPrompt = `Create content for: ${platform}
Topic: ${prompt}

Write platform-optimized content now.`;

    const result = await callLLM(SYSTEM_PROMPTS['content-creation'], userPrompt, {
      temperature: 0.85,
      maxTokens: 1500,
    });

    if (!result.success) throw new Error(result.error);
    return {
      text: result.content,
      meta: { platform },
      tokens: result.tokens,
    };
  },

  async editing(task) {
    const text = task.parameters?.text || task.description;
    const focus = task.parameters?.focus || 'general';

    const userPrompt = `Edit the following text. Focus: ${focus}

---
${text}
---

Provide:
1. The edited version
2. A brief summary of changes made`;

    const result = await callLLM(SYSTEM_PROMPTS.editing, userPrompt, {
      temperature: 0.4,
      maxTokens: 2500,
    });

    if (!result.success) throw new Error(result.error);
    return {
      text: result.content,
      meta: { focus, originalLength: text.length },
      tokens: result.tokens,
    };
  },

  async 'fact-check'(task) {
    const claims = task.parameters?.claims || task.description;

    const userPrompt = `Fact-check the following claims:

---
${claims}
---

Evaluate each claim and provide your assessment.`;

    const result = await callLLM(SYSTEM_PROMPTS['fact-check'], userPrompt, {
      temperature: 0.2,
      maxTokens: 2000,
    });

    if (!result.success) throw new Error(result.error);
    return {
      text: result.content,
      meta: { claimCount: claims.split(/\n/).filter(l => l.trim()).length },
      tokens: result.tokens,
    };
  },

  async admin(task) {
    const prompt = task.parameters?.prompt || task.description;
    const format = task.parameters?.format || 'report';

    const userPrompt = `Admin task: ${prompt}
Format: ${format}

Produce the requested output.`;

    const result = await callLLM(SYSTEM_PROMPTS.admin, userPrompt, {
      temperature: 0.5,
      maxTokens: 2000,
    });

    if (!result.success) throw new Error(result.error);
    return {
      text: result.content,
      meta: { format },
      tokens: result.tokens,
    };
  },

  async custom(task) {
    const prompt = task.parameters?.prompt || task.description;

    const result = await callLLM(SYSTEM_PROMPTS.custom, prompt, {
      temperature: 0.7,
      maxTokens: 2000,
    });

    if (!result.success) throw new Error(result.error);
    return {
      text: result.content,
      meta: { type: 'custom' },
      tokens: result.tokens,
    };
  },
};

// ============================================
// EXECUTION & REPORTING
// ============================================

async function executeTask(task) {
  const handler = HANDLERS[task.type] || HANDLERS.custom;
  try {
    const output = await handler(task);
    return {
      success: true,
      result: output.text,
      meta: output.meta,
      tokenUsage: output.tokens?.total || 0,
      modelUsed: LLM_MODEL,
    };
  } catch (error) {
    return { success: false, error: error.message, tokenUsage: 0 };
  }
}

// ============================================
// MAIN LOOP
// ============================================

async function poll() {
  try {
    const { data, status } = await api.get(`/api/tasks/poll?agent=${AGENT_ID}`);

    if (status === 204 || !data.task) {
      return;
    }

    const task = data.task;
    log('task', `Picked up: ${task.description} (${task.id}) [type: ${task.type}]`);

    const execution = await executeTask(task);

    if (execution.success) {
      await api.post(`/api/tasks/${task.id}/complete`, {
        workerId: AGENT_ID,
        result: execution.result,
        tokenUsage: execution.tokenUsage,
        modelUsed: execution.modelUsed,
      });
      log('complete', `Completed: ${task.description} | ${execution.tokenUsage} tokens | ${execution.modelUsed}`);
    } else {
      await api.post(`/api/tasks/${task.id}/fail`, {
        workerId: AGENT_ID,
        error: execution.error,
      });
      log('error', `Failed: ${task.description} - ${execution.error}`);
    }
  } catch (error) {
    if (error.response?.status !== 204) {
      log('error', `Poll error: ${error.message}`);
    }
  }
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║  NOVA HERMES — LLM-POWERED                                                    ║
║  Writer / Admin / Researcher — Oddsify Labs                                   ║
║  Model: ${LLM_MODEL.padEnd(62)}║
║  Provider: ${LLM_BASE_URL.padEnd(58)}║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
  `);

  log('info', `HAMH: ${HAMH_BASE_URL}`);
  log('info', `Poll interval: ${POLL_INTERVAL_MS}ms`);

  while (true) {
    await poll();
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
}

process.on('SIGINT', () => {
  log('info', 'Shutting down...');
  process.exit(0);
});

main().catch(err => {
  log('error', `Fatal: ${err.message}`);
  process.exit(1);
});
