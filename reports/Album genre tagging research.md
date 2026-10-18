# Tag every pick from Bandcamp first

Bandcamp Daily is the only one of your three sources that publishes machine-readable genre data. Every Album of the Day article carries exactly one editorial genre in its JSON-LD, and the linked Bandcamp album page carries artist-chosen tags that are specific on release day. Stereogum publishes no genre data, and The Needle Drop gives only five loose YouTube playlists, so for those picks you need outside sources and an LLM fallback. The sources also cover different ground. Stereogum Album of the Week is about 55-60% rock and punk. Bandcamp Album of the Day is spread across 20 genres and only about a quarter of it is rock. Needle Drop picks at 7/10 and up lean toward hip hop (about 23%), rock (19%) and metal (13%). Adopt a 17-family, two-level taxonomy that you own, with each node linked to a MusicBrainz genre ID. Map raw tags onto it with a rules pipeline (normalize, filter, alias, weighted family vote) adapted from beets' MIT-licensed lastgenre plugin. Send only low-confidence albums to an LLM limited to the taxonomy's IDs. Seed about two years of picks (roughly 750 albums) before launch. That freezes taxonomy v1, grows the alias table, and gives you a hand-checked evaluation set. **One caveat runs through the whole report: every Stereogum and Needle Drop genre label in the sample was estimated by the researchers, not taken from a source.** Those figures are marked † below.

## The three feeds cover three different genre profiles

The sample has 141 Stereogum picks (Jan 2024 – Oct 2026), 117 Bandcamp picks with a genre label (Apr – Oct 2026), and 134 Needle Drop albums scored 8+ or exactly 7 (late 2024 – Oct 2026). The three sources pick at very different rates. **Stereogum posts one pick every Tuesday, about 50 a year** ([Stereogum AOTW feed](https://www.stereogum.com/category/reviews/album-of-the-week/feed/)). **Bandcamp posts one every weekday, about 250 a year** ([Bandcamp AOTD listing](https://daily.bandcamp.com/album-of-the-day)). **The Needle Drop's Loved List holds 58, 55 and 46 albums at 8/10+ for 2024, 2025 and 2026 to date** ([Loved List 2026](https://theneedledrop.com/loved-list/2026/), [2025](https://theneedledrop.com/loved-list/2025/), [2024](https://theneedledrop.com/loved-list/2024/)). Adding 7/10 scores probably brings that to about 90-110 a year. So Bandcamp will supply roughly 60% of your pool, and its genre mix will set the site's character more than the other two.

The table shows each source's mix in that source's own family scheme. The schemes do not line up exactly. Bandcamp's "alternative" label covers post-punk, dream pop and even Aldous Harding, so its "Rock" figure is narrower than Stereogum's. On one shared scheme, Stereogum would be about 55-60% rock plus punk, and Bandcamp about 25%.

| Family | Stereogum AOTW† (n=126 classified) | Bandcamp AOTD (n=117, Bandcamp's own label) | Needle Drop 7+† (n=134) |
|---|---|---|---|
| Rock / Indie | 40% | 22% (alternative 21, rock 5) | 19% |
| Punk / Hardcore / Emo | 13% | 2% | 5% |
| Metal | 3% | 9% | 13% |
| Hip Hop | 6% | 11% | 23% |
| Pop | 9% | 3% | 10% |
| Electronic | 6% | 15% | 7% |
| Experimental | 6% | 11% | 4% |
| Folk / Country / Americana | 10% | 9% | 7% |
| R&B / Soul / Funk | 2% | 3% | 4% |
| Jazz | 2% | 5% | 1% |
| Ambient / Classical | 0% | 5% | 0% |
| Global / Latin | 2% | 5% | 3% |
| Unclassified | 15 picks | 3 picks | 4 picks |

† = researchers' own classification from general music knowledge. Sources: [Stereogum feed](https://www.stereogum.com/category/reviews/album-of-the-week/feed/), [Bandcamp genre listings such as /genres/metal](https://daily.bandcamp.com/genres/metal), [Needle Drop Loved Lists](https://theneedledrop.com/loved-list/2026/) and playlist RSS feeds.

The subgenres show the same split. **Stereogum's most frequent subgenres† are indie rock (about 30), post-punk (11), noise rock (9) and shoegaze (9)**, followed by singer-songwriter, indie pop, indie folk, emo, power pop and alt-country. Its rare families come from a small, steady set of artists: billy woods, MIKE and Navy Blue for hip hop, and Chat Pile and The Body for metal. **The Needle Drop's top subgenres† are noise rock (7), singer-songwriter, alternative hip hop and art pop (6 each), and abstract hip hop, sludge metal and art rock (5 each).** The Needle Drop has a long tail of "art-", "noise-", "post-" and "abstract-" labels, and mainstream styles like trap, EDM and K-pop are rare among his high scores. **Bandcamp's subgenre evidence comes from the source** (article deks and album tags), not estimates. Its metal picks cover doom, black metal, death metal and prog metal (Witchthroat Serpent, HULDER, Left to Die, Papangu) ([genres/metal](https://daily.bandcamp.com/genres/metal)). It also runs reissues and regional scenes the other two never touch: Dutch Caribbean experiments from 1968-86, Ethiopian music, Greek Orthodox chant labelled "devotional", and Indonesian jazz ([AOTD listing](https://daily.bandcamp.com/album-of-the-day?page=3)).

**The sources rarely overlap.** Only L'Rain, Aldous Harding, Water From Your Eyes, Sprints and Danny Brown were picked by both Stereogum and Bandcamp in the window ([Stereogum feed](https://www.stereogum.com/category/reviews/album-of-the-week/feed/); [Bandcamp listing](https://daily.bandcamp.com/album-of-the-day)). Gilla Band, Lip Critic, Kelela, Chat Pile and Cameron Winter link Stereogum with The Needle Drop. A "picked by several sources" boost will therefore fire rarely. In practice you should expect indie and post-punk, electronic and club, underground hip hop, metal and experimental music most of the time. Jazz, ambient, Latin and global music will show up every week or two. R&B, reggae, classical and blues will be rare.

The sample has known gaps. Fifteen Stereogum picks, mostly small 2026 artists, and four Needle Drop albums could not be classified at all. Exact 7/10 scores exist only for 2026, because YouTube RSS shows just the latest 15 items per feed. Bandcamp labels cover only Apr – Oct 2026.

## Only Bandcamp exposes genres; everything else comes from outside

**Bandcamp Daily articles carry one genre each**, in JSON-LD (`"genre"` URL plus `"keywords"`), in `<meta property="article:tag">`, and in a footer link to `bandcamp.com/discover/<genre>`. In the sample, 0 of 117 articles had two genres ([Green Lung AOTD](https://daily.bandcamp.com/album-of-the-day/green-lung-necropolitan-review)). The linked album page adds free-form artist tags. Green Lung's page lists NWOBHM, Rock, doom, folk horror, hard rock, heavy metal, occult rock, stoner rock and London ([greenlung.bandcamp.com](https://greenlung.bandcamp.com/album/necropolitan-2)). These tags mix genre, mood and place, so they need filtering. **Stereogum exposes no genre at all.** Its RSS categories are "Album Of The Week", "Reviews" and artist names, and its JSON-LD has only `articleSection` ([Sophia Stel AOTW](https://stereogum.com/2514364/album-of-the-week-sophia-stel-the-greatest-album-of-all-time/reviews/album-of-the-week/)). **The Needle Drop's 2026 video descriptions have no "Genre:" line.** His only genre signal is which of five playlists a review is in: Rock, Hip Hop, Pop, Loud Rock, and Other. The playlists are used loosely. Nia Archives' jungle and Kelela's alternative R&B were filed under Pop, and By Storm's experimental hip hop under Other ([Pop feed](https://www.youtube.com/feeds/videos.xml?playlist_id=PLP4CSgl7K7oqibt_5oDPppWxQ0iaxyyeq), [Other feed](https://www.youtube.com/feeds/videos.xml?playlist_id=PLP4CSgl7K7orSnEBkcBRqI5fDgKSs5c8o)). Treat Hip Hop and Loud Rock as useful hints and Pop and Other as close to noise.

For outside sources, a live test on 2026-10-18 with three albums gives the main trade-off. Pardoner's *Target Practice* came out two days before the test. **MusicBrainz had a release group for it but no genres or tags; Bandcamp, Deezer and iTunes all had usable genres on day two.** The older albums had MusicBrainz album genres, but with only 1-3 votes each. In ListenBrainz's fresh-releases feed, only about 8% of 1,744 releases from the past 7 days had any tags. MusicBrainz album tagging lags for new releases, which is exactly the case your picker faces.

| Source | Access | New-indie coverage | Granularity / noise | Terms for a personal site |
|---|---|---|---|---|
| Bandcamp Daily article | HTML/JSON-LD, no key | Every AOTD pick | 1 editorial family, clean | Personal non-commercial use ([ToS](https://bandcamp.com/terms_of_use)) |
| Bandcamp album page | HTML scrape, 1 fetch per album | Day one, if on Bandcamp | Specific; mixes locations and moods, duplicate tags | Same; one polite fetch per featured album, never crawl |
| MusicBrainz release group / artist | Free API, 1 req/s, User-Agent required ([rate limits](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)) | Album genres lag weeks or months; artist genres usually present | `genres` field is filtered to the curated list of 2,216 genres; raw `tags` are noisy | Genre list CC0; per-release tag votes CC BY-NC-SA 3.0 ([license](https://musicbrainz.org/doc/About/Data_License)) |
| Last.fm top tags | Free API key | Untested; probably lags for small releases | Rich but noisy crowd tags | Non-commercial only, attribution, and **prior written approval for public pages** ([ToS](https://www.last.fm/api/tos)) |
| Deezer | No key; send `Accept-Language: en` | Good if in stores | 1-2 coarse store genres | Non-commercial only ([terms](https://developers.deezer.com/termsofuse)) |
| iTunes Search | No key, about 20 calls/min ([docs](https://performance-partners.apple.com/search-api)) | Good if matched | 1 coarse genre; search often returns the wrong artist | Check the artist match on every result |
| Discogs | Token, 60 req/min | Good for catalogued releases | Curated styles | Licence of genre data unclear |
| Wikidata | SPARQL | Sparse for new indie | Clean but thin | CC0; endpoint was limited to 1 req/min on test day |
| Spotify, RYM, AOTY, Every Noise | — | — | — | Not usable: Spotify's Dev Mode needs Premium and genre fields are missing ([changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026)); RYM and AOTY block scripts; Every Noise has been frozen since Dec 2023 ([TechCrunch](https://techcrunch.com/2024/02/12/every-noise-shut-down-spotify-layoffs)) |

The practical ranking is: Bandcamp (article genre plus album tags), then MusicBrainz (album genres, then artist genres), then Deezer or iTunes as a coarse family fallback. Last.fm is the best crowd-tag source on paper. Its approval clause for public pages makes it the strictest free option, so leave it out of v1 unless you get approval. Last.fm and Discogs were not tested live, and three test albums are not a statistical sample.

## Adopt 17 families you own, anchored to MusicBrainz IDs

No reusable taxonomy fits as it stands. **Bandcamp's Discover tree is the closest in shape: 27 top genres and 237 subgenres, embedded as JSON in `bandcamp.com/discover`** ([bandcamp.com/discover](https://bandcamp.com/discover)). It uses the same slugs as the album-page tags. But it has no licence, includes non-music families (podcasts, audiobooks), and lacks subgenres your sources use often, such as slowcore, post-metal, art pop and desert blues. The **beets genre tree (MIT, 21 roots)** is reusable, but it puts metal and indie under rock, which is wrong for these sources ([genres-tree.yaml](https://raw.githubusercontent.com/beetbox/beets/master/beetsplug/lastgenre/genres-tree.yaml)). **MusicBrainz genre names, aliases and MBIDs are CC0 core data** ([MusicBrainz Database](https://musicbrainz.org/doc/MusicBrainz_Database)). That makes MusicBrainz the right anchor. Build your own tree, and store an MBID on every node that has one. Genre names and groupings are facts, so the tree you build is yours.

The research team drafted a 20-family tree. Given the sample, merge it down to 17. Fold Dance & Club into Electronic and Blues into Country & Americana, both of which are near zero in the data. Combine Soundtrack with Spoken Word & Other. Keep Indie & Alternative separate from Rock, because otherwise one family would hold 40% of Stereogum. Keep Punk & Hardcore and Metal separate, because the Needle Drop's Loud Rock picks and Stereogum's hardcore picks need somewhere to go. The family list and the subgenre examples below are a recommendation, not a sourced standard.

| Family | Example subgenres | Bandcamp Daily genre → family | Needle Drop playlist prior |
|---|---|---|---|
| Indie & Alternative | indie rock, shoegaze, dream pop, slowcore, jangle pop, post-rock, art rock, noise pop, emo | alternative | Rock |
| Rock | psych rock, garage rock, krautrock, stoner rock, hard rock, prog | rock | Rock |
| Punk & Hardcore | post-punk, hardcore, post-hardcore, pop punk, noise rock (secondary: Indie) | punk | Loud Rock / Rock |
| Metal | black, death, doom/sludge, post-metal, blackgaze, grindcore, metalcore | metal | Loud Rock |
| Hip Hop | abstract/experimental, boom bap, jazz rap, UK rap/drill, rage | hip-hop-rap | Hip Hop (strong) |
| R&B & Soul | alt-R&B, neo-soul, soul, funk, gospel | r-b-soul, funk | Pop (weak) |
| Pop | art pop, synth-pop, hyperpop, dance-pop, chamber pop | pop | Pop (weak) |
| Electronic | house, techno, IDM, jungle/D&B, UK bass, footwork, club, disco | electronic | Pop (weak) |
| Ambient & Drone | ambient, drone, new age, field recordings | ambient | Other (weak) |
| Experimental | noise, avant-garde, free improvisation, sound art, industrial | experimental | Other (weak) |
| Jazz | spiritual, free, fusion, UK/contemporary jazz | jazz | Other (weak) |
| Folk & Singer-Songwriter | indie folk, art folk, singer-songwriter, American primitive guitar | folk, acoustic | Other (weak) |
| Country & Americana | alt-country, americana, bluegrass, blues | country, blues | — |
| Global | Latin (reggaeton, cumbia, bolero), African, desert blues, MENA, Asian, devotional | world, latin, devotional | — |
| Reggae & Dub | roots, dub, dancehall, ska | reggae | — |
| Classical & Contemporary | modern classical, minimalism, chamber | classical | — |
| Soundtrack & Other | film score, game music, spoken word | soundtrack, spoken-word, comedy | — |

Allow more than one parent where a subgenre has two homes. Bandcamp's own tree puts emo under both alternative and punk, and noise under ambient, experimental and metal ([bandcamp.com/tags](https://bandcamp.com/tags)). Give each subgenre one canonical parent for display and optional secondary parents for filtering. Each album gets exactly 1 primary family, 0-2 secondary families and 1-3 subgenres. That matches how RYM, AOTY and Bandcamp all present genre: one headline genre plus a few specific ones.

## Run a rules pipeline first and call the LLM only when unsure

The tagger takes inputs in priority order, and each input carries a weight. For a Bandcamp pick, the article's editorial genre is a strong family prior. The album-page tags provide the subgenres. For every pick, query MusicBrainz release-group `genres`, but count them only when the total votes are at least 2. Otherwise fall back to MusicBrainz artist genres at a lower weight. A test artist had 11 artist genres against 3 album genres, so artist-level data is richer, but it describes the career, not this album. Deezer and iTunes vote at family level only. For Needle Drop picks, Hip Hop and Loud Rock playlist membership is a moderate prior and Pop or Other a weak one. Stereogum adds nothing except the review text, which goes to the LLM. Budget about **3 MusicBrainz requests per album (search, release group, artist), so about 3 s at the 1 req/s limit**. Exceeding the limit makes every request fail with 503 until the rate drops ([MB rate limiting](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)).

Normalization follows the beets lastgenre design ([docs](https://beets.readthedocs.io/en/stable/plugins/lastgenre.html)). First, apply NFKC, lowercase, trim, and collapse `&`/`and`/`n` and hyphen or space variants. Second, run ordered regex aliases. Port beets' `aliases.yaml`, which already maps `dnb`/`d&b` to drum and bass and `post rock` to post-rock ([aliases.yaml](https://raw.githubusercontent.com/beetbox/beets/master/beetsplug/lastgenre/aliases.yaml)). Third, drop non-genre tags with a typed stoplist:

- years and decades, by regex
- locations, matched against MusicBrainz Areas (CC0), unless the alias table already knows the tag as a scene genre such as "dunedin sound"
- moods, moved to an optional separate facet
- meta tags such as "seen live"
- instruments and languages
- the release's own label name

Fourth, look up each surviving tag in an alias table that maps raw strings to subgenre node IDs. Seed it from MusicBrainz genre names and aliases, Bandcamp sub-tags and beets `genres.txt`. A few strings are ambiguous: hardcore, garage, dub, noise, indie, alternative, experimental. Resolve these by checking which family the other tags already vote for. If that does not settle it, map the tag to family level only.

Scoring is a weighted vote. Each tag adds source weight × tag weight to its subgenre and rolls up to that subgenre's family. The primary family is the top scorer. Families scoring at least about 0.4 of the top become secondary. Set confidence to high when the top family has at least 60% of the score and at least 2 independent sources agree, medium at 40% or more, and low otherwise. These thresholds are starting points from the research team, not measured values. Tune them on your evaluation set. Store `genre_source` (rules, llm or manual), `confidence` and each tag's origin on every album. Log every unmatched normalized tag with a count. Reviewing the top of that log each week is how the alias table improves.

Send low-confidence albums, and Stereogum picks with no Bandcamp page, to an LLM classifier. Give it artist, album, the cleaned tags with their sources, and a short excerpt of the review, since review prose describes the genre well. Use structured output with enums of stable IDs such as `metal.black-metal`. Claude's structured outputs guarantee schema compliance, but **they "may change the capitalization of an enum" value, so validate case-insensitively, and `minItems` is limited to 0 or 1, so enforce "max 3 subgenres" in code** ([Claude structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)). A two-stage call keeps the enums small and avoids the API's "schema too complex" error: pick the family first, then pick subgenres from that family's list. Guard against wrong answers in three ways. The enum constraint limits the output. A server-side whitelist check catches anything outside the taxonomy. When the rules had high confidence and the LLM disagrees on the primary family, keep the rules' answer and flag the album for review. A Haiku-tier model is enough. At about 400 picks a year the cost is negligible, though current pricing was not checked. **No published benchmark exists for LLM genre classification from text metadata**, so the evaluation set below is the only way to know whether this works. If the LLM fails or the API is down, use the coarse Deezer or iTunes family at low confidence. Re-run the tagger on new releases after 4-6 weeks, when MusicBrainz votes have filled in. Cache results per MBID or URL so an album is only reclassified when its tags change.

On the home cluster, this is one more step in the existing daily CronJob. Keep a persistent cache of API responses, an identifying User-Agent with contact details, and the Anthropic key in a k8s Secret. Credit MusicBrainz in the site footer as "Genre data from MusicBrainz, CC BY-NC-SA 3.0".

## Seed about 750 past picks to freeze the taxonomy before launch

Seeding is practical because all three sources expose history cheaply:

- **Stereogum:** the AOTW RSS feed pages 1-4 return every pick since Aug 2023.
- **Bandcamp:** the AOTD listing pages give about 30 picks each. The `/genres/<slug>` listings label articles in bulk, and each article's JSON-LD gives an exact label at about 1 request per pick ([genres listing](https://daily.bandcamp.com/genres/metal)).
- **The Needle Drop:** the Loved Lists give every 8+ album for 2024-2026.

The one gap is historical 7/10 Needle Drop scores. The RSS feeds hold only 15 items each. The Kaggle dataset (1,272 rows, coarse genres) is older and its licence is unverified, so seed The Needle Drop with 8+ albums only and add 7s from now on ([Kaggle](https://www.kaggle.com/datasets/apat0saur/theneedledrop-reviews)). Two years back gives roughly 100 Stereogum, 500 Bandcamp and 160 Needle Drop albums.

Run the production tagger over this seed rather than a separate one-off script. At about 3 MusicBrainz requests per album, the seed takes under an hour on MusicBrainz plus a few hours of Bandcamp fetches at 2-3 s pauses. Then do three things. First, read the unmatched-tag log and the resulting family and subgenre counts. Add subgenres that recur (slowcore, blackgaze and art folk will) and drop ones that never appear. Freeze that as taxonomy v1. Second, hand-label about 200 albums across all three sources and every family. Use them to tune the thresholds and to compare rules-only, LLM-only and the hybrid. Third, keep the seed as the site's back catalogue. At about 400 picks a year the sources can fill a daily slot, but Stereogum's December gaps and Bandcamp's weekend gaps will need back-catalogue picks.

One trap: seeded albums are months or years old, so MusicBrainz has had time to fill in their genres. That makes them easier than a two-day-old release. To evaluate the new-release path fairly, re-tag a slice of the evaluation set using only the sources available on release day: the Bandcamp article and page, Deezer, iTunes, MusicBrainz artist genres and the LLM.

## Conclusion

Most of the genre problem is solved by where your picks come from. About six in ten picks arrive from Bandcamp with an editor's family label and artist tags already attached. The hard cases are the roughly one in eight that come from Stereogum, which needs outside data and the review text, and brand-new albums missing from MusicBrainz. So the LLM fallback mainly serves Stereogum, plus the 15% of its picks that are small, hard-to-place artists. It is not a general classifier, and it deserves its own evaluation on Stereogum picks.

The researchers' estimates are a starting picture, not data, and that is the strongest argument for the seeding step. Seeding turns the † estimates into real pipeline output, and the gap between the estimates and the pipeline's answers will show you where the taxonomy and the alias table are wrong before any visitor sees a mislabelled album.
