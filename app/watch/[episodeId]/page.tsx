import { notFound } from "next/navigation";
import { SeriesPlayer } from "@/components/series-player";
import { getSeriesEpisodes, getWatchEpisode } from "@/lib/data";

export const revalidate = 30;

export default async function WatchPage({
  params
}: {
  params: Promise<{ episodeId: string }>;
}) {
  const { episodeId } = await params;
  let episode;
  let episodes;

  try {
    episode = await getWatchEpisode(episodeId);
    episodes = await getSeriesEpisodes(episode);
  } catch {
    notFound();
  }

  return (
    <SeriesPlayer
      episodes={episodes}
      initialEpisodeId={episode.id}
      series={
        episode.series ?? {
          id: episode.series_id,
          title: "Drama",
          cover_url: null
        }
      }
    />
  );
}
