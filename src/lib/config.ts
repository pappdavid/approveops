export const SERVICE_CONFIG = {
  name: process.env.NEXT_PUBLIC_SERVICE_NAME ?? "ApproveOps",
  tagline: process.env.NEXT_PUBLIC_SERVICE_TAGLINE ?? "Human approval for risky agent actions",
  slug: "approveops",
} as const;
