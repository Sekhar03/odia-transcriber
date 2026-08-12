export function extractVideoId(url) {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  const match = trimmed.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#&?]*).*/);
  return match && match[2].length === 11 ? match[2] : null;
}
