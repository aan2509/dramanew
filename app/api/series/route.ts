import { NextRequest, NextResponse } from "next/server";
import { getSeriesPage } from "@/lib/data";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = Number(searchParams.get("page") ?? "0");
  const providerId = searchParams.get("providerId") ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const query = searchParams.get("q") ?? undefined;

  try {
    const result = await getSeriesPage({
      providerId,
      category,
      query,
      page: Number.isFinite(page) && page >= 0 ? page : 0
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load series" },
      { status: 500 }
    );
  }
}
