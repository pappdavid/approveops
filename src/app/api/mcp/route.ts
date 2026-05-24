import { NextRequest, NextResponse } from "next/server";

function verifyMcpSecret(request: NextRequest): boolean {
  const secret = process.env.MCP_API_SECRET;
  if (!secret) return false;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!verifyMcpSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // TODO: implement MCP tool dispatch for ApproveOps
  // Each tool should be registered here and routed to its handler.
  console.log("[mcp] incoming request", body);

  return NextResponse.json({ status: "ok", product: "approveops" });
}

export async function GET() {
  return NextResponse.json({
    product: "approveops",
    mcp: true,
    tools: [],
  });
}
