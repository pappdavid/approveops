<div align="center">

# ApproveOps

**Human approval queue and deterministic risk-classification prototype for agent actions**

[Live demo](https://approveops.vercel.app)

</div>

## Scope

ApproveOps accepts an action description, assigns a deterministic risk level, stores a pending approval request, and lets the owning user approve or reject it with an optional reason.

It provides:

- action submission and risk classification
- pending, approved, and rejected request states
- per-user approval queues
- guarded one-time decisions on pending requests
- security events for submission and decisions
- dashboard and bearer-authenticated tool-style HTTP access

Submitting an action to ApproveOps does not automatically stop an external agent. The calling system must wait for and enforce the recorded decision.

## Risk classification

The current classifier evaluates the action title and description using transparent rules:

| Level | Current signals |
|---|---|
| `critical` | drop, delete, destroy, wipe, truncate, remove all |
| `high` | production/live access, credentials, authorization or privilege changes |
| `medium` | deploy, release, restart, rollback, migration, or other state changes |
| `low` | no matched state-changing or sensitive signal |

Actions at `medium`, `high`, or `critical` require approval. The classifier is intentionally small and auditable; it is not a semantic policy engine.

## Transactional audit invariant

Approval creation and its `approval_submitted` event are written in one database transaction. Approval or rejection and the corresponding audit event are also transactional.

A decision updates only a pending request owned by the current actor. Repeated, cross-user, or stale decisions fail rather than silently overwriting the record.

## Verified behavior

GitHub Actions verifies the project on Node.js 20 with:

- dependency installation and Prisma client generation
- Vitest unit tests
- TypeScript type-checking
- ESLint
- a production Next.js build

The tests cover risk classification, per-user list isolation, transactional submission, pending-only decisions, ownership checks, and audit-event creation.

## Architecture

- `src/lib/risk-classifier.ts`: deterministic action classification
- `src/lib/approvals.ts`: approval lifecycle and transactional audit writes
- `src/app/dashboard`: approval queue and audit history
- `src/app/api/mcp/route.ts`: bearer-authenticated tool-style HTTP endpoint
- `prisma/schema.prisma`: PostgreSQL users, requests, and security events

The `/api/mcp` route uses tool-shaped JSON over HTTP. It is not a full Model Context Protocol transport implementation.

## Tool-style HTTP API

Set `MCP_API_SECRET`, then submit a request:

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Authorization: Bearer $MCP_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "approvals.create",
    "input": {
      "title": "Restart production worker",
      "description": "Restart the live billing worker",
      "actor": {
        "id": "clerk_user_id",
        "email": "user@example.com"
      }
    }
  }'
```

Supported tools:

- `approvals.list`: list the current actor's recent requests
- `approvals.create`: classify and create a pending request
- `approvals.decide`: approve or reject a pending request owned by the actor

Responses use `{ "ok": true, "result": ... }` on success. The create response returns the stored approval object, including status and risk fields; it does not generate an approval URL.

## Local development

Requirements:

- Node.js 20
- PostgreSQL, including Neon-compatible connection strings
- Clerk application credentials

```bash
git clone https://github.com/pappdavid/approveops.git
cd approveops
cp .env.example .env.local
npm ci
npm run db:generate:ci
npm run db:push
npm run dev
```

Environment variables:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk browser key |
| `CLERK_SECRET_KEY` | Clerk server key |
| `DATABASE_URL` | PostgreSQL pooled connection string |
| `DIRECT_URL` | PostgreSQL direct connection string |
| `MCP_API_SECRET` | Bearer secret for the tool-style HTTP endpoint |

## Development commands

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Current limitations

- the caller must enforce the approval result around the external action
- the current queue is owner-scoped rather than a multi-reviewer organization workflow
- classification is deterministic keyword matching, not semantic policy evaluation
- the HTTP endpoint is tool-shaped, not full MCP transport
- production use still requires authentication design, reviewer roles, expiry, notifications, and operational monitoring
