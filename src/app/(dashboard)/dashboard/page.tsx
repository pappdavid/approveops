import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  createApprovalRequest,
  decideApprovalRequest,
  listApprovalRequests,
} from "../../../lib/approvals";
import { SubmitButton } from "./submit-button";

function getPrimaryEmail(user: NonNullable<Awaited<ReturnType<typeof currentUser>>>) {
  const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress;
  return primary ?? user.emailAddresses[0]?.emailAddress ?? null;
}

function getRiskReasons(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function riskClassName(riskLevel: string) {
  switch (riskLevel) {
    case "critical":
      return "border-red-300 bg-red-50 text-red-700";
    case "high":
      return "border-orange-300 bg-orange-50 text-orange-700";
    case "medium":
      return "border-amber-300 bg-amber-50 text-amber-700";
    default:
      return "border-emerald-300 bg-emerald-50 text-emerald-700";
  }
}

function statusClassName(status: string) {
  switch (status) {
    case "APPROVED":
      return "border-emerald-300 bg-emerald-50 text-emerald-700";
    case "REJECTED":
      return "border-red-300 bg-red-50 text-red-700";
    default:
      return "border-slate-300 bg-slate-50 text-slate-700";
  }
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

  let approvals: Awaited<ReturnType<typeof listApprovalRequests>> = [];
  let loadError: string | null = null;

  try {
    approvals = await listApprovalRequests({ clerkUserId: user.id });
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load approval requests.";
  }

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
              minLength={1}
              maxLength={200}
              aria-describedby="title-help"
              className="rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="e.g. Deploy new billing worker"
            />
            <p id="title-help" className="text-xs text-muted-foreground">
              Required. Keep it short enough for reviewers to scan.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="description" className="text-xs font-medium text-muted-foreground">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              maxLength={5000}
              aria-describedby="description-help"
              className="resize-y rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="What is being requested, why, and what could go wrong?"
            />
            <p id="description-help" className="text-xs text-muted-foreground">
              Include environment, data touched, and rollback notes when relevant.
            </p>
          </div>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Creating...">
              Create
            </SubmitButton>
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Recent requests</h2>
          <span className="text-xs text-muted-foreground">{approvals.length} shown</span>
        </div>
        {loadError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Approval requests could not be loaded. {loadError}
          </div>
        ) : approvals.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No approval requests yet. Submit an agent action above to classify its risk and create the first pending review.
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {approvals.map((req) => {
              const riskReasons = getRiskReasons(req.riskReasons);

              return (
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
                    <div className="flex flex-wrap justify-end gap-2">
                      <span className={`rounded-full border px-2 py-1 text-xs capitalize ${riskClassName(req.riskLevel)}`}>
                        {req.riskLevel} risk
                      </span>
                      <span className={`rounded-full border px-2 py-1 text-xs ${statusClassName(req.status)}`}>
                        {req.status === "PENDING" ? "Pending" : req.status === "APPROVED" ? "Approved" : "Rejected"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 rounded-md bg-muted/40 p-3">
                    <p className="text-xs font-medium text-foreground">Risk summary</p>
                    <p className="mt-1 text-sm text-muted-foreground">{req.riskSummary}</p>
                    {riskReasons.length > 0 ? (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {riskReasons.map((reason) => (
                          <li key={reason} className="rounded-full border bg-background px-2 py-1 text-xs text-muted-foreground">
                            {reason}
                          </li>
                        ))}
                      </ul>
                    ) : null}
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
                            maxLength={2000}
                            className="rounded-md border bg-background px-3 py-2 text-sm"
                            placeholder="e.g. Looks safe — ship it"
                          />
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <SubmitButton name="decision" value="reject" pendingLabel="Rejecting..." variant="secondary">
                            Reject
                          </SubmitButton>
                          <SubmitButton name="decision" value="approve" pendingLabel="Approving...">
                            Approve
                          </SubmitButton>
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
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
