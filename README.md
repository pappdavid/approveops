# ApproveOps

ApproveOps is a lean approval gate for agent actions: submit an action, classify deterministic risk, hold it for human approval, approve or reject it, and keep an audit trail.

**Production URL:** https://approveops.vercel.app

## Core Flow

1. An authenticated user submits an agent action from `/dashboard` or through the REST MCP endpoint.
2. `src/lib/risk-classifier.ts` deterministically assigns `low`, `medium`, `high`, or `critical` risk with reasons and a summary.
3. The request is stored as `PENDING` with risk details in Supabase Postgres through Prisma.
4. The same Clerk user can list and decide only their own requests.
5. Approval submit and decision events are written to `SecurityEvent` and rendered in the dashboard audit log.

## Setup

```bash
cp .env.example .env.local
npm install
npm run db:generate
npm run db:push
npm run dev
```

Open `http://localhost:3000/dashboard` and sign in with Clerk.

## Environment Variables

Required for the MVP:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `DATABASE_URL`: Supabase pooled Postgres connection string.
- `DIRECT_URL`: Supabase direct Postgres connection string.
- `MCP_API_SECRET`: bearer token for `/api/mcp`.

Optional:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` for future Supabase client features.

## Demo Flow

1. Sign in at `/dashboard`.
2. Submit `Drop production database` with a description like `Agent wants to run DROP TABLE users in prod`.
3. Confirm the request appears as pending with `critical risk`, risk reasons, and a summary.
4. Add an optional decision note, then approve or reject it.
5. Confirm the request moves to approved or rejected and the audit log shows `approval_submitted` plus `approval_approved` or `approval_rejected`.

MCP example:

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

## Checks

```bash
npm run db:generate
npm test
npm run typecheck
npm run lint
npm run build
```

## Known Limitations

- The classifier is deterministic and keyword-based; it is intentionally conservative but not a full policy engine.
- Approval ownership is scoped to the request creator. There is no team review queue or delegated approver role yet.
- Audit events are stored in `SecurityEvent` and shown in the dashboard, but there is not yet advanced filtering or export.
- The REST MCP endpoint trusts the supplied `actor` after validating `MCP_API_SECRET`; production agent integrations should map actors from a trusted identity source.
