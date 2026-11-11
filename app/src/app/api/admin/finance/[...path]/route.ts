import { forwardFinance } from "@/lib/api/financeProxy";
import type { NextRequest } from "next/server";

type Context = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, context: Context) {
  const { path } = await context.params;
  return forwardFinance(req, path, "/api/admin/finance");
}

export async function POST(req: NextRequest, context: Context) {
  const { path } = await context.params;
  return forwardFinance(req, path, "/api/admin/finance");
}

export async function PATCH(req: NextRequest, context: Context) {
  const { path } = await context.params;
  return forwardFinance(req, path, "/api/admin/finance");
}

export async function DELETE(req: NextRequest, context: Context) {
  const { path } = await context.params;
  return forwardFinance(req, path, "/api/admin/finance");
}
