<div align="center">

# ApproveOps

**Human-in-the-loop approval gate for AI agent actions**

[![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Clerk](https://img.shields.io/badge/Auth-Clerk-6C47FF?logo=clerk&logoColor=white)](https://clerk.com)
[![Prisma](https://img.shields.io/badge/ORM-Prisma-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![Supabase](https://img.shields.io/badge/DB-Supabase-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Tailwind CSS](https://img.shields.io/badge/CSS-Tailwind-06B6D4?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com)

**[Live Demo →](https://approveops.vercel.app)**

</div>

---

## What It Does

ApproveOps puts a human in the loop for any action an AI agent wants to take. An agent submits an action, the deterministic risk classifier immediately assigns a risk level, the request lands in a pending queue, and a human approves or rejects it — with a full audit trail for every decision.

No ML inference. No black boxes. Deterministic classification, instant results.

---

## Approval Flow

```mermaid
sequenceDiagram
    participant Agent as AI Agent
    participant API as ApproveOps API
    participant DB as Supabase Postgres
    participant Human as Human Reviewer
    participant Audit as Audit Log

    Agent->>API: POST /api/mcp {tool: "approvals.create"}
    API->>API: risk-classifier.ts<br/>→ low/medium/high/critical
    API->>DB: INSERT ApprovalRequest (PENDING)
    API-->>Agent: {id, status: PENDING, riskLevel}

    Human->>API: GET /dashboard (list pending)
    API->>DB: SELECT WHERE status=PENDING
    DB-->>Human: Pending requests with risk details

    Human->>API: POST approve / reject + note
    API->>DB: UPDATE status, decidedAt, decisionReason
    API->>Audit: SecurityEvent {approval_approved / rejected}
    API-->>Human: Updated request
```

---

## Risk Classification

ApproveOps classifies every action deterministically — keyword and pattern matching on the action title and description:

```
Risk Levels
├── critical  → production database operations, credential changes, force pushes
├── high      → production deployments, user data exports, infrastructure changes
├── medium    → staging changes, schema migrations, external API calls
└── low       → read-only operations, local tests, non-destructive commands
```

---

## Data Model

```mermaid
erDiagram
    User ||--o{ ApprovalRequest : "creates / decides"
    User ||--o{ SecurityEvent : triggers

    User {
        string id PK
        string clerkId UK
        string email
    }
    ApprovalRequest {
        string id PK
        string title
        ApprovalStatus status
        string riskLevel
        json riskReasons
        string riskSummary
        datetime decidedAt
        string decisionReason
    }
    SecurityEvent {
        string id PK
        string type
        string severity
        json details
    }
```

---

## Tech Stack

<div align="center">

![Next.js](https://skillicons.dev/icons?i=nextjs)&nbsp;
![TypeScript](https://skillicons.dev/icons?i=ts)&nbsp;
![Tailwind](https://skillicons.dev/icons?i=tailwind)&nbsp;
![Prisma](https://skillicons.dev/icons?i=prisma)&nbsp;
![PostgreSQL](https://skillicons.dev/icons?i=postgres)

</div>

---

## Quick Start

```bash
cp .env.example .env.local
# Fill in Clerk keys, Supabase connection strings, MCP secret
npm install
npm run db:generate && npm run db:push
npm run dev
```

Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard).

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `DATABASE_URL` | Supabase pooled Postgres connection string |
| `DIRECT_URL` | Supabase direct Postgres connection string |
| `MCP_API_SECRET` | Bearer token for `/api/mcp` |

---

## MCP API

Submit approval requests programmatically from any AI agent:

```bash
curl -s http://localhost:3000/api/mcp \
  -H "Authorization: Bearer $MCP_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "approvals.create",
    "input": {
      "title": "Restart production worker",
      "description": "Agent wants to restart the live billing worker",
      "actor": { "id": "clerk_user_id", "email": "user@example.com" }
    }
  }'
```

Response includes `riskLevel`, `riskReasons`, and the approval URL.

---

## Demo Flow

1. Sign in at `/dashboard`
2. Submit `Drop production database` — action receives **critical** risk classification automatically
3. Review risk reasons and summary in the pending queue
4. Add an optional decision note, then approve or reject
5. Audit log shows `approval_submitted` → `approval_approved` or `approval_rejected`

---

## Project Structure

```
src/
  app/
    dashboard/          # Approval queue + audit log
    (auth)/             # Clerk sign-in / sign-up
    api/mcp/            # MCP REST endpoint
  lib/
    risk-classifier.ts  # Deterministic risk classification
    analytics.ts        # Security event persistence
    db.ts               # Prisma singleton
prisma/
  schema.prisma         # User, ApprovalRequest, SecurityEvent
```

---

## Development Scripts

```bash
npm run dev           # Start dev server
npm run build         # Production build
npm run typecheck     # TypeScript check
npm run lint          # ESLint
npm run db:generate   # Regenerate Prisma client
npm run db:push       # Push schema to DB
npm test              # Vitest unit tests
```
