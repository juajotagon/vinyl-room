# Daily album pick: where the recommendation comes from

Checked on 2026-10-18 from juanjo's laptop with plain scripted requests,
the same way a daily k8s CronJob would make them.

## Recommendation

Use **Bandcamp Daily "Album of the Day"** as the main source, then fill in
the details with **MusicBrainz / Cover Art Archive**, which the MVP already
uses. Bandcamp only posts it on weekdays, so on weekends the job picks from
**Stereogum's Album of the Week** or the latest **Bandcamp Essential
Releases** list. Claude writes a short original description each day and
links to the source review.

Why: it is the only source that is curated, fresh every weekday, reachable
by a script without fighting a bot wall, and comes with cover art and a
legal embedded player. AOTY and RYM, which you named, both block scripts.

## Sources compared

| Source | Curated? | Fresh daily? | Script access | Notes |
|---|---|---|---|---|
| Bandcamp Daily, Album of the Day | Yes, editors | Weekdays | RSS feed works (200) | Each item has title, short summary, cover image and the review link. The review page links the bandcamp.com album, which has an official embed player. |
| Bandcamp Daily, Essential Releases | Yes | Weekly, Fridays | Same RSS feed | About 5 to 10 albums per post. Good weekend pool. |
| Stereogum, Album of the Week | Yes | Weekly | RSS feed works (40 items) | Indie and rock leaning. |
| Pitchfork album reviews | Yes, scored | Several a day | RSS feed works | The feed has no score, so "Best New Music" can't be picked out without scraping pages. |
| The Quietus | Yes | Daily-ish | RSS feed works | Mixes reviews with news and features, so it needs filtering. |
| ListenBrainz fresh releases | No | Yes | Open JSON API (200), open data | About 1,700 releases a week with MusicBrainz IDs and covers, but no quality signal: listen counts were all 0. Good for details, not for choosing. |
| Last.fm | No | No | Needs a free API key | Popularity charts, not fresh picks. Could add "similar artists" later. |
| AOTY (albumoftheyear.org) | Yes, critic and user scores | Yes | **403 on every page I tried** | No official API. Unofficial scrapers exist but break when the HTML changes. I could not read their terms of use. |
| RYM (rateyourmusic.com) | Yes, user charts | Yes | **403 on every request, terms page included** | No public API. RYM is known for blocking automated access, but I couldn't read the terms to confirm the exact wording. |

## More sources (second round)

| Source | What you get | Script access | Verdict |
|---|---|---|---|
| The Needle Drop (Anthony Fantano) | New album reviews several times a week, with a score like "8/10" in each video description | YouTube channel RSS works (200, 15 items), scores parse out cleanly | **Strong pick.** Closest in taste to the AOTY/RYM crowd, and it's an official feed. |
| Bandcamp Discover | Best-selling and newest albums, filterable by genre | JSON endpoint that Bandcamp's robots.txt explicitly allows (POST works) | Good for "trending in a genre". Not documented, so it could change. |
| Deezer editorial selection | Editors' picks with covers | Public API, no key needed (works) | Works, but leans mainstream. The "releases" list came back empty. |
| The Guardian album reviews | Reviews with star ratings | Official Open Platform API, free developer key | Reliable and legal. The shared "test" key is rejected now, so you'd register for a free key. |
| Apple Music RSS | Top albums by plays | Official JSON feed, no key | Popularity only (Zach Bryan, Drake, Taylor Swift this week). Not discovery. |
| Paste, BrooklynVegan, Aquarium Drunkard | Reviews mixed with news | RSS works | Usable only with filtering, so noisy. |
| NPR Music | Mostly features and Tiny Desk | RSS works | Few album picks. |
| AllMusic Editors' Choice, Metacritic, Sputnikmusic | Curated or scored new releases | Pages load (200), no API | Scraping only. Fragile, and terms unclear. |
| Reddit r/indieheads | Fresh album threads | RSS search came back empty; the API needs an OAuth app | Not worth it for now. |
| Guardian RSS, Resident Advisor, Line of Best Fit, KEXP, Boomkat | | 404 or 403 at the URLs I tried | Skip unless you particularly want one. |

### Updated recommendation

Build a small **pool of fresh picks** each day instead of relying on one
site:

- Bandcamp Daily Album of the Day (weekdays)
- The Needle Drop reviews scoring 8/10 or higher
- Stereogum Album of the Week
- Optionally, Guardian 4 and 5 star reviews (free key)

The job picks the newest album in the pool that hasn't been shown yet,
preferring albums that more than one source liked. That gives you a
critics' consensus feel similar to AOTY, using only official feeds and APIs.

## How the daily job would work

1. A k8s CronJob runs once a day, early morning.
2. It reads the Bandcamp Daily RSS feed and takes today's Album of the Day.
   On a weekend it uses the fallback pool.
3. It looks the album up on MusicBrainz to get a large cover, the
   tracklist and the release year. If there's no match, it uses Bandcamp's
   cover image.
4. Claude writes a 2 to 3 sentence description from the album details and
   the review summary, in its own words, with a link to the review.
5. The job saves `today.json` and the cover where the site can serve them,
   plus a small history so it never repeats a pick. The browser renders
   everything, as you agreed.

Optional: a Bandcamp embedded player under the record, so people can
listen while it spins.

## Things to decide

- Which sources go in the pool (see the updated recommendation above).

- Whether to add the weekend fallback, or only show Album of the Day
  (Friday's pick stays up over the weekend).
- Whether descriptions come from Claude (needs an Anthropic API key as a
  k8s Secret) or use only the review link and a short excerpt.
- Whether AOTY is worth it later through an unofficial API, accepting
  that it can break.
