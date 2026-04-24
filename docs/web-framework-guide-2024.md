# Choosing the Right Web Development Stack in 2024: An Oddsify Labs Technical Guide

> **Ruth Hermes** — Web Developer, Oddsify Labs
> _A Collins & Collins Technologies Company_

---

## The Framework Paradox

Pick any programming forum in 2024 and you’ll find the same argument: React vs Vue vs Svelte vs Angular vs Solid vs Qwik vs Fresh vs Astro vs...

It’s noise. Here’s the truth most guides won’t tell you: **the framework matters less than the deployment model, the data flow, and how fast your team can ship.**

At Oddsify Labs, we run six autonomous AI agents, a command hub (HAMH), multiple VPS instances, Railway deployments, and a public-facing company site. We don’t have time for framework bikeshedding. We need tools that get out of the way.

This guide cuts through the marketing. It’s written for builders — CTOs, technical leads, and solo devs who ship.

---

## 1. First, Define Your Deployment Target

Before you look at a single framework, answer this:

> Where does this thing live?

Your answer determines 70% of your stack.

| Deployment Target | Natural Stack | Why |
|---|---|---|
| **VPS / Dedicated Server** | Node.js + Express, Go, or Python (FastAPI) | You control the environment. No serverless constraints. Long-running processes welcome. |
| **Railway / Render / Fly** | Anything with a Dockerfile or native buildpack | These platforms abstract the server. Focus on the runtime, not the config. |
| **Vercel / Netlify / Cloudflare Pages** | Next.js, Nuxt, SvelteKit, Astro, Remix | Static generation + serverless functions baked in. CDN-first by design. |
| **Raspberry Pi / Edge Device** | Lightweight: Go, Rust, or Python (Flask/FastAPI) | Memory and CPU are real constraints. Every MB matters. |
| **AI Agent / Bot Infrastructure** | Node.js (event-driven) or Python (ML libs) | Websockets, polling, and API glue are the job. Not rendering HTML. |

### Oddsify Labs Reality Check

- HAMH (Hermes Agent Management Hub) runs on a **Hostinger VPS** → Node.js + Express + static HTML dashboard
- Alexbet Sharp runs on **Railway** → Node.js API with zero frontend
- Our public site (`oddsifylabs.com`) is static HTML deployed to **Cloudflare Pages**
- Agent bots run on **Telegram + local Node.js processes**

**We have three different stacks for three different deployment targets.** That’s not inconsistency — that’s picking the right tool for the job.

---

## 2. The Frontend Decision Matrix (2024)

If you’re building something humans interact with in a browser, here’s how the landscape actually breaks down:

### A. The Meta-Framework Era

In 2024, you rarely pick a UI library in isolation. You pick a **meta-framework** that handles routing, data fetching, SSR/SSG, and deployment.

| Meta-Framework | Built On | Best For | Trade-off |
|---|---|---|---|
| **Next.js** | React | SEO-heavy apps, e-commerce, marketing sites | Complex. Server/client boundaries are a footgun. |
| **Nuxt** | Vue | Teams that prefer Vue’s template syntax | Smaller ecosystem than Next.js |
| **SvelteKit** | Svelte | Speed and simplicity. Compiles away framework code. | Smaller talent pool, newer |
| **Astro** | Framework-agnostic (React, Vue, Svelte islands) | Content sites, docs, marketing pages | Not for heavy client-side apps |
| **Remix** | React | Full-stack data flow, forms, progressive enhancement | Smaller ecosystem |
| **Fresh** | Preact | Deno-first, edge-optimized, zero build step | Deno ecosystem is niche |

### B. When You DON’T Need a Meta-Framework

This is the section most 2024 guides skip. At Oddsify Labs, **HAMH’s dashboard is vanilla HTML, CSS, and JavaScript.** No build step. No Vite. No bundler.

Here’s when vanilla wins:

1. **Admin dashboards / internal tools** — You control the browser. You don’t need hydration strategies.
2. **Prototypes / MVPs** — Get the API working first. Worry about the frontend framework after you have users.
3. **Agent interfaces** — Your users are other bots, not humans. JSON in, JSON out.
4. **Sites with <5 interactive elements** — Loading 100KB of React runtime for a toggle switch is engineering malpractice.
5. **Long-running dashboards** — No build step means no dependency rot. The HAMH dashboard will work in 2030 without a single `npm audit fix`.

### C. The Build Tool Layer

If you DO need a build step:

| Tool | Role | Status |
|---|---|---|
| **Vite** | Dev server + bundler | The new standard. Replaced Create React App and Webpack for new projects. |
| **esbuild** | Ultra-fast bundler | Powers Vite. Good for standalone CLI tools. |
| **Turbopack** | Next.js’s bundler | Still maturing. Only relevant if you’re deep in Next.js. |
| **Bun** | JS runtime + bundler + package manager | Fast. Compatible with Node.js. Watch this space. |
| **Webpack** | Legacy bundler | Still used in enterprise. Don’t start new projects here. |
| **Parcel** | Zero-config bundler | Nice for simple projects. Vite has largely eaten its lunch. |

**Oddsify Labs call:** For HAMH, we stayed vanilla. For our next customer-facing product, we’ll likely use Vite + vanilla or SvelteKit.

---

## 3. The Backend Decision Matrix (2024)

### A. API-First Backends

| Framework / Runtime | Language | Best For | Oddsify Use Case |
|---|---|---|---|
| **Express.js / Fastify** | JavaScript / TypeScript | API servers, agent orchestration, tool glue | ✅ HAMH server |
| **FastAPI** | Python | ML-heavy services, data science APIs | Agent integrations |
| **Go (net/http, Gin, Echo)** | Go | High-throughput APIs, microservices | Future monitoring service |
| **Ruby on Rails** | Ruby | Rapid prototyping, CRUD-heavy apps | Not used at Oddsify |
| **Django / DRF** | Python | Admin-heavy apps, content management | Not used at Oddsify |
| **Laravel** | PHP | Shared hosting, traditional web apps | Not used at Oddsify |
| **Spring Boot** | Java | Enterprise, heavily regulated industries | Not used at Oddsify |
| **.NET Core** | C# | Windows shops, enterprise APIs | Not used at Oddsify |

### B. The Real-Time Layer

If your app needs real-time updates (HAMH does), your framework choice is secondary to your transport:

| Transport | When to Use | Implementation |
|---|---|---|
| **Server-Sent Events (SSE)** | One-way server → client (dashboard updates, logs) | Dead simple. One HTTP connection. |
| **WebSockets** | True bidirectional (chat, live collaboration) | More complex. Needs connection management. |
| **Polling** | Fallback, or when updates are low-frequency | Simple but wasteful. Fine for HAMH’s 3s interval. |
| **Long Polling** | Middle ground | Rarely needed in 2024. SSE replaces most use cases. |

**HAMH currently uses polling.** For v2, we’re evaluating SSE to reduce server load.

---

## 4. The Database Layer (Often Ignored)

Your framework choice is tightly coupled to your data layer. Here’s the 2024 reality:

| Database | Type | Best For | Framework Pairing |
|---|---|---|---|
| **PostgreSQL** | Relational | The default choice. JSONB makes it quasi-NoSQL. | Everything. Use Prisma or Drizzle as ORM. |
| **SQLite** | File-based relational | Embedded apps, mobile, low-traffic sites | Bun has native SQLite. Python has sqlite3. |
| **MongoDB** | Document | Rapid iteration, unstructured data | Works well with Node.js (Mongoose). |
| **Redis** | In-memory / cache | Sessions, real-time leaderboards, task queues | Every stack needs this for caching. |
| **Supabase / Firebase** | Hosted PostgreSQL / Document | Faster time-to-market, auth built-in | Any frontend. Great for MVPs. |
| **PlanetScale** | Serverless MySQL | Branching schema, deploy previews | Next.js, Vercel-native. |
| **Turso** | SQLite at the edge | Edge functions, global low-latency | New. Exciting for edge-deployed apps. |

**Oddsify Labs call:** HAMH uses in-memory queues for now. For v2, we’re evaluating PostgreSQL + Drizzle ORM for persistence, with Redis for task queue buffering.

---

## 5. The Hidden Costs of Framework Choice

### A. The Talent Market

| Framework | Hiring Pool | Average Salary Impact |
|---|---|---|
| React / Next.js | Massive | Baseline |
| Vue / Nuxt | Medium | Slightly lower |
| Svelte / SvelteKit | Small | Harder to hire |
| Angular | Enterprise-focused | Higher (senior devs) |
| Vanilla JS | Universal | Lowest (everyone knows it) |

**For Oddsify Labs:** We use vanilla JS + Node.js because every developer and agent can read it. No framework lock-in. No "we need a Next.js specialist."

### B. The Upgrade Treadmill

React 18 → 19. Next.js 13 → 14 → 15. Vue 2 → 3. Angular...

Every major framework release requires migration work. Vanilla code from 2019 still runs in 2024. Our HAMH dashboard will run in 2029.

### C. Bundle Size Tax

| Framework | Minified Runtime | Notes |
|---|---|---|
| React 18 | ~40KB | Plus ReactDOM |
| Vue 3 | ~34KB | Smaller than React |
| Svelte | ~2KB (compiler) | Virtually no runtime |
| Preact | ~10KB | React-compatible drop-in |
| Vanilla | 0KB | Browser-native |

For an internal dashboard on a VPS, that 40KB doesn’t matter. For a customer-facing marketing page where Core Web Vitals affect SEO, it matters a lot.

---

## 6. Decision Framework: What Oddsify Labs Actually Uses

### Scenario A: Public Marketing Site
→ **Astro + Tailwind + deployed to Cloudflare Pages**
- Ships zero JS by default
- Island architecture for the few interactive bits
- CDN-native. Global edge. No server to manage.

### Scenario B: Customer Dashboard / SaaS App
→ **SvelteKit or Next.js + Vercel / Railway**
- Server-side rendering for auth and initial load
- API routes colocated with frontend
- TypeScript throughout

### Scenario C: Internal Agent Management Tool (HAMH)
→ **Node.js + Express + Vanilla HTML/CSS/JS + VPS**
- No build step. No dependencies in the frontend.
- SSH into the server and edit files directly if needed.
- Runs for years without maintenance.

### Scenario D: AI Agent / Bot Service
→ **Node.js or Python. No frontend at all.**
- Telegram bot API, REST endpoints, or message queues.
- The interface is JSON, not HTML.

### Scenario E: Edge-Deployed Monitoring
→ **Go or Rust + Cloudflare Workers**
- Cold start under 1ms
- Deploy globally in 30 seconds
- No server management whatsoever

---

## 7. Red Flags: Frameworks to Avoid in 2024

1. **Anything requiring Webpack for new projects** — Use Vite. Full stop.
2. **jQuery for new development** — Browser APIs have caught up. `fetch`, `querySelectorAll`, and modern CSS handle 95% of what jQuery did.
3. **Create React App** — Deprecated. Use Vite + React or Next.js.
4. **Angular for small teams** — The learning curve is real. The boilerplate is heavy.
5. **Over-engineered micro-frontends** — Unless you’re Shopify or Figma, you don’t need this.

---

## 8. The Oddsify Labs Stack (Summary)

| Layer | Technology | Why |
|---|---|---|
| **Frontend (public)** | Static HTML + CSS | Speed, control, no build step |
| **Frontend (dashboard)** | Vanilla JS + CSS Grid/Flexbox | Internal tool. Zero dependency overhead. |
| **Backend (API)** | Node.js + Express | Event-driven, perfect for agent orchestration |
| **Transport** | HTTP REST + polling (v1), evaluating SSE (v2) | Simple, debuggable, works everywhere |
| **Deployment (VPS)** | PM2 + Nginx + SSL | Battle-tested, fully controlled |
| **Deployment (serverless)** | Railway + Cloudflare Pages | For services that need zero ops |
| **Database (evaluating)** | PostgreSQL + Drizzle | Type-safe ORM, relational integrity |
| **Queue (evaluating)** | Redis + BullMQ | Reliable task processing |
| **Language** | JavaScript (Node.js) | Universal. Every agent speaks it. |

---

## Conclusion

The "right" framework doesn’t exist. The right **stack for your deployment target, team size, and maintenance tolerance** does.

At Oddsify Labs, we optimize for:
- **Speed of iteration** — ship today, not next sprint
- **Operational simplicity** — fewer moving parts = fewer 3 AM pages
- **Longevity** — code that works in 2029 without a rewrite

Sometimes that means Next.js. Sometimes it means vanilla JavaScript and a static file server.

Choose boring technology for critical paths. Experiment with new frameworks on greenfield projects. And never let a framework choice block a shipping decision.

---

*Questions? Reach out to the Oddsify Labs engineering team at dev@oddsify-labs.com.*

*Built with ❤️ by Ruth Hermes, Web Developer, Oddsify Labs*
