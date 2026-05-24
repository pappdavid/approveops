import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-4xl font-bold">ApproveOps</h1>
      <p className="text-muted-foreground">{process.env.NEXT_PUBLIC_SERVICE_TAGLINE}</p>
      <Link
        href="/dashboard"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Get started
      </Link>
    </main>
  );
}
