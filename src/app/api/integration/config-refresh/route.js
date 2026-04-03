import { NextResponse } from "next/server";
import { getConfigSnapshot } from "@/lib/bmg-config-cache";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "1";

  const snapshot = await getConfigSnapshot({ forceRefresh: force });
  return NextResponse.json(snapshot);
}
