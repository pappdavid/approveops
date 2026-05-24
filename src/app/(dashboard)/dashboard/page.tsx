import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  createApprovalRequest,
  decideApprovalRequest,
  listApprovalRequests,
} from "../../../lib/approvals";

function getPrimaryEmail(user: NonNullable<Awaited<ReturnType<typeof currentUser>>>) {
  const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress;
  return primary ?? user.emailAddresses[0]?.emailAddress ?? null;
}

async function createApprovalAction(formData: FormData) {
  "use server";

  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const email = getPrimaryEmail(user);
  if (!email) throw new Error("User email is required.");

  await createApprovalRequest({
    clerkUser: { id: user.id, email },
    input: {
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
    },
  });

  revalidatePath("/dashboard");
}

async function decideApprovalAction(formData: FormData) {
  "use server";

  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const email = getPrimaryEmail(user);
  if (!email) throw new Error("User email is required.");

  await decideApprovalRequest({
    clerkUser: { id: user.id, email },
    input: {
      requestId: String(formData.get("requestId") ?? ""),
      decision: formData.get("decision") === "reject" ? "reject" : "approve",
      reason: String(formData.get("reason") ?? "") || undefined,
    },
  });

  revalidatePath("/dashboard");
}

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const approvals = await listApprovalRequests();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-8">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">ApproveOps</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review and decide agent-initiated requests.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{user.firstName ?? "User"}</span>
        </p>
      </header>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Create approval request</h2>
        <form action={createApprovalAction} className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="title" className="text-xs font-medium text-muted-foreground">
              Title
            </label>
            <input
              id="title"
              name="title"
              required
              className="rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="e.g. Deploy new billing worker"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="description" className="text-xs font-medium text-muted-foreground">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              className="resize-y rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="What is being requested, why, and what could go wrong?"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            >
              Create
            </button>
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Recent requests</h2>
        {approvals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No approval requests yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {approvals.map((req) => (
              <li key={req.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{req.title}</p>
                    {req.description ? (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                        {req.description}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-muted-foreground">
                      Created {req.createdAt.toLocaleString()}
                    </p>
                  </div>
                  <span className="rounded-full border px-2 py-1 text-xs">
                    {req.status === "PENDING" ? "Pending" : req.status === "APPROVED" ? "Approved" : "Rejected"}
                  </span>
                </div>

                {req.status === "PENDING" ? (
                  <div className="mt-4 flex flex-col gap-2">
                    <form action={decideApprovalAction} className="flex flex-col gap-2">
                      <input type="hidden" name="requestId" value={req.id} />
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground" htmlFor={`reason-${req.id}`}>
                          Decision note (optional)
                        </label>
                        <input
                          id={`reason-${req.id}`}
                          name="reason"
                          className="rounded-md border bg-background px-3 py-2 text-sm"
                          placeholder="e.g. Looks safe — ship it"
                        />
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="submit"
                          name="decision"
                          value="reject"
                          className="rounded-md border bg-background px-3 py-2 text-sm font-medium"
                        >
                          Reject
                        </button>
                        <button
                          type="submit"
                          name="decision"
                          value="approve"
                          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                        >
                          Approve
                        </button>
                      </div>
                    </form>
                  </div>
                ) : req.decidedAt ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Decided {req.decidedAt.toLocaleString()}
                    {req.decisionReason ? ` • ${req.decisionReason}` : ""}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
