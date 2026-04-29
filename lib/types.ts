export type Provider = {
  id: string;
  slug: string;
  name: string;
};

export type Series = {
  id: string;
  provider_id: string;
  platform: string | null;
  provider_series_id?: string | null;
  title: string;
  description: string | null;
  cover_url: string | null;
  chapter_count: number | null;
  play_count?: number | null;
  tags: string[] | null;
};

export type Episode = {
  id: string;
  series_id: string;
  platform?: string | null;
  provider_series_id?: string | null;
  title: string | null;
  episode_index: number | null;
  episode_number: number | null;
  source_m3u8_url: string | null;
  subtitle_url: string | null;
  subtitle_language: string | null;
};

export type WatchEpisode = Episode & {
  series: Pick<Series, "id" | "title" | "cover_url" | "description"> | null;
};
