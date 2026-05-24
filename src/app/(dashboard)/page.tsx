import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">ApproveOps</h1>
      <p className="mt-2 text-muted-foreground">Welcome, {user.firstName}.</p>
      {/* TODO: implement product UI */}
    </div>
  );
}
