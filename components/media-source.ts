export function isHlsSource(src: string) {
  const lowerSource = src.toLowerCase();

  try {
    const url = new URL(src);
    const pathname = decodeURIComponent(url.pathname.toLowerCase());
    const decodedSegments = url.pathname
      .split("/")
      .map((segment) => decodeBase64UrlSafe(segment))
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      pathname.endsWith(".m3u8") ||
      pathname.includes("m3u8") ||
      url.search.toLowerCase().includes("m3u8") ||
      decodedSegments.includes(".m3u8") ||
      decodedSegments.includes("m3u8")
    );
  } catch {
    return lowerSource.includes("m3u8");
  }
}

export function getDecodedMediaSource(src: string) {
  try {
    const url = new URL(src);
    const decoded = url.pathname
      .split("/")
      .map((segment) => decodeBase64UrlSafe(segment))
      .find((value) => value.startsWith("http://") || value.startsWith("https://"));

    return decoded && decoded !== src ? decoded : null;
  } catch {
    return null;
  }
}

function decodeBase64UrlSafe(value: string) {
  if (value.length < 12) return "";

  try {
    const normalized = value
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(value.length / 4) * 4, "=");
    return atob(normalized);
  } catch {
    return "";
  }
}
