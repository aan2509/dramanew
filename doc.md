
# Frontend Data Access Guide

Dokumen ini menjelaskan cara frontend atau AI coding assistant mengambil data katalog dari Supabase untuk aplikasi drama streaming.

## Arsitektur Baru

Telegram tidak dipakai sebagai storage utama. Scraper hanya bertugas mengisi metadata dan URL stream ke Supabase.

Alur data:

```txt
Provider API -> Scraper -> Supabase -> Frontend -> HLS player
```

Frontend membaca:

- `providers`: daftar provider aktif.
- `series`: daftar drama/judul milik provider.
- `episodes`: daftar episode dan URL `.m3u8`.

Player memakai:

- `episodes.source_m3u8_url` untuk video HLS.
- `episodes.subtitle_url` jika subtitle tersedia.

## Tabel Utama

### `providers`

Daftar sumber konten.

Kolom penting:

| Column | Type | Purpose |
| --- | --- | --- |
| `id` | uuid | Primary key provider. |
| `slug` | text | Kode provider, contoh `dramabox`. |
| `name` | text | Nama tampilan provider. |
| `base_url` | text | Base URL API provider. |
| `is_active` | boolean | Hanya provider aktif yang ditampilkan frontend. |

Catatan: `telegram_channel_id` boleh diabaikan jika Telegram storage tidak dipakai.

### `series`

Daftar drama/judul.

Kolom penting:

| Column | Type | Purpose |
| --- | --- | --- |
| `id` | uuid | Primary key series. |
| `provider_id` | uuid | Relasi ke `providers.id`. |
| `platform` | text | Slug provider, contoh `dramabox`. |
| `provider_series_id` | text | ID series dari provider upstream. |
| `title` | text | Judul drama. |
| `description` | text | Deskripsi drama. |
| `cover_url` | text | Poster/cover drama. |
| `chapter_count` | integer | Jumlah episode dari provider. |
| `tags` | text[] | Genre/tag jika tersedia. |

### `episodes`

Daftar episode per series.

Kolom penting:

| Column | Type | Purpose |
| --- | --- | --- |
| `id` | uuid | Primary key episode. |
| `series_id` | uuid | Relasi ke `series.id`. |
| `platform` | text | Slug provider. |
| `provider_series_id` | text | ID series dari provider upstream. |
| `episode_index` | integer | Index asli dari provider, bisa mulai dari 0, 1, atau kasus khusus. |
| `episode_number` | integer | Nomor episode normal untuk frontend, mulai dari 1. |
| `title` | text | Judul episode. |
| `source_m3u8_url` | text | URL video HLS yang dipakai player. |
| `subtitle_url` | text | URL subtitle jika tersedia. |
| `subtitle_language` | text | Bahasa subtitle. |
| `storage_status` | enum | Status lama untuk pipeline Telegram; bisa diabaikan untuk direct HLS. |

Frontend sebaiknya memakai `episode_number` untuk urutan tampilan, bukan `episode_index`.

## Environment Frontend

Frontend hanya boleh memakai Supabase anon key, bukan service role key.

Contoh `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Jangan pernah expose:

```env
SUPABASE_SERVICE_ROLE_KEY
DRACINKU_API_KEY
TELEGRAM_BOT_TOKEN
TELEGRAM_STRING_SESSION
```

## Supabase Client

Contoh client untuk Next.js:

```ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

## Query Provider

Ambil semua provider aktif:

```ts
const { data: providers, error } = await supabase
  .from("providers")
  .select("id, slug, name")
  .eq("is_active", true)
  .order("name", { ascending: true });

if (error) throw error;
```

Output yang diharapkan:

```ts
type Provider = {
  id: string;
  slug: string;
  name: string;
};
```

## Query Series Berdasarkan Provider

Ambil daftar drama untuk satu provider:

```ts
const { data: series, error } = await supabase
  .from("series")
  .select(
    "id, provider_id, platform, provider_series_id, title, description, cover_url, chapter_count, tags"
  )
  .eq("provider_id", providerId)
  .order("title", { ascending: true })
  .range(0, 19);

if (error) throw error;
```

Untuk infinite scroll, naikkan range:

```ts
const pageSize = 20;
const from = page * pageSize;
const to = from + pageSize - 1;

const { data } = await supabase
  .from("series")
  .select("id, title, cover_url, chapter_count, tags")
  .eq("provider_id", providerId)
  .order("title", { ascending: true })
  .range(from, to);
```

## Search Series

Cari drama berdasarkan judul:

```ts
const { data: results, error } = await supabase
  .from("series")
  .select("id, provider_id, title, cover_url, chapter_count")
  .eq("provider_id", providerId)
  .ilike("title", `%${query}%`)
  .order("title", { ascending: true })
  .limit(30);

if (error) throw error;
```

## Query Detail Series

Ambil detail drama:

```ts
const { data: detail, error } = await supabase
  .from("series")
  .select(
    "id, provider_id, platform, provider_series_id, title, description, cover_url, chapter_count, play_count, tags"
  )
  .eq("id", seriesId)
  .single();

if (error) throw error;
```

## Query Episode Berdasarkan Series

Ambil semua episode untuk satu drama:

```ts
const { data: episodes, error } = await supabase
  .from("episodes")
  .select(
    "id, series_id, title, episode_index, episode_number, source_m3u8_url, subtitle_url, subtitle_language"
  )
  .eq("series_id", seriesId)
  .not("source_m3u8_url", "is", null)
  .order("episode_number", { ascending: true });

if (error) throw error;
```

Output yang diharapkan:

```ts
type Episode = {
  id: string;
  series_id: string;
  title: string | null;
  episode_index: number;
  episode_number: number | null;
  source_m3u8_url: string | null;
  subtitle_url: string | null;
  subtitle_language: string | null;
};
```

## Memilih Episode untuk Player

Gunakan `source_m3u8_url` sebagai sumber video.

```ts
const selectedEpisode = episodes[0];
const videoUrl = selectedEpisode.source_m3u8_url;
const subtitleUrl = selectedEpisode.subtitle_url;
```

Jika `source_m3u8_url` kosong, tampilkan state unavailable:

```ts
if (!videoUrl) {
  return <p>Video belum tersedia.</p>;
}
```

## HLS Player

Browser iOS/Safari bisa memutar `.m3u8` langsung. Chrome, Android, dan desktop biasanya perlu `hls.js`.

Install:

```bash
npm install hls.js
```

Client component:

```tsx
"use client";

import Hls from "hls.js";
import { useEffect, useRef } from "react";

type HlsPlayerProps = {
  src: string;
  poster?: string | null;
  subtitleUrl?: string | null;
  subtitleLabel?: string | null;
};

export function HlsPlayer({ src, poster, subtitleUrl, subtitleLabel }: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
      });

      hls.loadSource(src);
      hls.attachMedia(video);

      return () => hls.destroy();
    }
  }, [src]);

  return (
    <video
      ref={videoRef}
      poster={poster ?? undefined}
      controls
      playsInline
      preload="metadata"
      style={{ width: "100%", background: "#000" }}
    >
      {subtitleUrl ? (
        <track
          kind="subtitles"
          src={subtitleUrl}
          srcLang="id"
          label={subtitleLabel ?? "Indonesia"}
          default
        />
      ) : null}
    </video>
  );
}
```

## Contoh Alur Halaman

### `/providers`

1. Query `providers`.
2. Tampilkan card provider.
3. Klik provider menuju `/providers/[slug]`.

### `/providers/[slug]`

1. Query provider berdasarkan `slug`.
2. Query `series` berdasarkan `provider.id`.
3. Tampilkan daftar drama dengan pagination/infinite scroll.

### `/series/[seriesId]`

1. Query detail dari `series`.
2. Query episode dari `episodes`.
3. Tampilkan deskripsi dan daftar episode.
4. Pilih episode pertama yang punya `source_m3u8_url`.
5. Render `HlsPlayer`.

## Catatan Penting

URL `.m3u8` dari provider bisa berubah, expired, atau diblokir CORS. Jika player gagal memutar URL langsung dari Supabase, solusi production yang disarankan adalah membuat backend resolver/proxy HLS:

```txt
Frontend -> Backend /play/:episodeId -> Supabase -> Provider API -> HLS response
```

Backend bisa refresh `source_m3u8_url` saat link lama mati.

## Rule of Thumb untuk AI Assistant

Saat membangun frontend:

1. Ambil provider dari tabel `providers`.
2. Ambil drama dari tabel `series` memakai `provider_id`.
3. Ambil episode dari tabel `episodes` memakai `series_id`.
4. Urutkan episode memakai `episode_number`.
5. Pakai `source_m3u8_url` sebagai video source.
6. Pakai `subtitle_url` jika ada.
7. Jangan memakai `telegram_msg_id` jika Telegram storage tidak digunakan.
8. Jangan expose secret server ke frontend.
