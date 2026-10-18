// Cover image URLs. We never download or store images: the site loads them
// live (through the /cover proxy, see server/cover-proxy.mjs).
import { get } from './http.mjs';

export const caaUrl = (mbid) => (mbid ? `https://coverartarchive.org/release-group/${mbid}/front-500` : null);

// Best first, no duplicates, no empties.
export const coverList = (...urls) => [...new Set(urls.flat().filter((u) => typeof u === 'string' && /^https:\/\//.test(u)))];

// The og:image of a Bandcamp (or any) page, or null.
export async function ogImage(pageUrl) {
  try {
    const html = await get(pageUrl, { tries: 2 });
    const tag = html.match(/<meta[^>]+property=["']og:image["'][^>]*>/i)?.[0];
    const url = tag?.match(/content=["']([^"']+)["']/i)?.[1];
    return url ? url.replace(/&amp;/g, '&') : null;
  } catch {
    return null;
  }
}
