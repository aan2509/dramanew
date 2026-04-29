import { NextRequest, NextResponse } from "next/server";
import { getSeriesEpisodes } from "@/lib/data";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const searchParams = request.nextUrl.searchParams;
  const platform = searchParams.get("platform");
  const providerSeriesId = searchParams.get("providerSeriesId");

  try {
    const episodes = await getSeriesEpisodes({
      id,
      platform,
      provider_series_id: providerSeriesId
    });

    return NextResponse.json({ episodes });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load series episodes"
      },
      { status: 500 }
    );
  }
}
