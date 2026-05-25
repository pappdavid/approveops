# Agent instructions

## Cost-control rules

- Do not repeatedly retry commands that fail because of firewall, DNS, or allowlist errors.
- Do not ask to allowlist `checkpoint.prisma.io`; Prisma checkpoint and update checks are optional and must stay disabled.
- In agent and CI contexts, use install commands with lifecycle scripts disabled.
- Use `npm run db:generate:ci`, not raw `prisma generate`.
- If Prisma attempts to contact `checkpoint.prisma.io`, patch scripts and environment first, then retry once.
- Prefer static code review before expensive install or build attempts.
- Do not trigger extra CI runs unless explicitly requested.
