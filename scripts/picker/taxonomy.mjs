// The site's own genre tree: 17 families, each with subgenres and the raw
// tags (aliases) that map to them. Shaped by what Bandcamp Daily, Stereogum
// and The Needle Drop actually pick (see reports/Album genre tagging research.md).
//
// Rules:
// - ids are stable lowercase slugs; names are for display.
// - aliases are matched after normalize() (lowercase, no accents, no hyphens).
// - `tags` on a family are generic tags that only say "this family"
//   (e.g. "rock", "electronic"), without naming a subgenre.
// - `bandcamp` lists the Bandcamp Daily / Discover top-genre slugs that map here.
// - A subgenre that lives in two families is listed once, under its main
//   family, with `also: [otherFamily]`.

export const FAMILIES = [
  {
    id: 'indie',
    name: 'Indie & Alternative',
    bandcamp: ['alternative'],
    tags: ['indie', 'alternative', 'alternative rock', 'alt rock', 'indie alternative', 'college rock', 'lo fi', 'lofi'],
    subgenres: [
      ['indie-rock', 'Indie Rock', ['indie rock', 'indie guitar']],
      ['indie-pop', 'Indie Pop', ['indie pop', 'twee', 'twee pop'], ['pop']],
      ['shoegaze', 'Shoegaze', ['shoegaze', 'shoegazer', 'nu gaze', 'nugaze']],
      ['dream-pop', 'Dream Pop', ['dream pop', 'dreampop', 'ethereal wave']],
      ['slowcore', 'Slowcore', ['slowcore', 'sadcore']],
      ['jangle-pop', 'Jangle Pop', ['jangle', 'jangle pop', 'janglepop']],
      ['bedroom-pop', 'Bedroom Pop', ['bedroom pop', 'lo fi pop', 'lofi pop', 'lo fi indie']],
      ['emo', 'Emo', ['emo', 'midwest emo', 'emo revival', 'emocore'], ['punk']],
      ['math-rock', 'Math Rock', ['math rock', 'mathrock']],
      ['post-rock', 'Post-Rock', ['post rock', 'postrock']],
      ['art-rock', 'Art Rock', ['art rock', 'experimental rock', 'avant rock']],
      ['noise-pop', 'Noise Pop', ['noise pop']],
      ['grunge', 'Grunge', ['grunge', 'post grunge'], ['rock']],
      ['slacker-rock', 'Slacker Rock', ['slacker rock', 'slacker']],
      ['britpop', 'Britpop', ['britpop', 'brit pop']],
      ['goth', 'Goth & Darkwave', ['goth', 'gothic rock', 'darkwave', 'coldwave', 'deathrock', 'post punk revival goth']],
    ],
  },
  {
    id: 'rock',
    name: 'Rock',
    bandcamp: ['rock'],
    tags: ['rock', 'retro rock', 'industrial rock', 'rock and roll', 'rock n roll', 'guitar rock', 'classic rock'],
    subgenres: [
      ['psych-rock', 'Psychedelic Rock', ['psychedelic rock', 'psych rock', 'psych', 'psychedelic', 'neo psychedelia', 'acid rock', 'heavy psych', 'heavy psychedelic']],
      ['garage-rock', 'Garage Rock', ['garage rock', 'garage', 'garage revival']],
      ['prog-rock', 'Progressive Rock', ['prog rock', 'progressive rock', 'prog', 'art prog']],
      ['krautrock', 'Krautrock', ['krautrock', 'kosmische', 'motorik']],
      ['stoner-rock', 'Stoner & Desert Rock', ['stoner rock', 'stoner', 'desert rock', 'fuzz rock']],
      ['hard-rock', 'Hard Rock', ['hard rock', 'heavy rock']],
      ['blues-rock', 'Blues Rock', ['blues rock'], ['country']],
      ['glam-rock', 'Glam Rock', ['glam rock', 'glam']],
      ['surf-rock', 'Surf Rock', ['surf rock', 'surf']],
      ['power-pop', 'Power Pop', ['power pop', 'powerpop'], ['pop']],
      ['occult-rock', 'Occult Rock', ['occult rock', 'proto metal'], ['metal']],
    ],
  },
  {
    id: 'punk',
    name: 'Punk & Hardcore',
    bandcamp: ['punk'],
    tags: ['punk', 'punk rock'],
    subgenres: [
      ['post-punk', 'Post-Punk', ['art punk', 'dance punk', 'post punk', 'postpunk', 'post punk revival']],
      ['hardcore', 'Hardcore', ['hardcore punk', 'hardcore', 'hxc', 'beatdown', 'youth crew', 'powerviolence', 'd beat', 'crust', 'crust punk'], ['metal']],
      ['post-hardcore', 'Post-Hardcore', ['post hardcore', 'posthardcore', 'screamo']],
      ['pop-punk', 'Pop Punk', ['pop punk', 'poppunk', 'skate punk']],
      ['noise-rock', 'Noise Rock', ['noise rock', 'noiserock', 'scuzz', 'pigfuck'], ['indie']],
      ['garage-punk', 'Garage & Egg Punk', ['garage punk', 'egg punk', 'eggpunk', 'synth punk']],
      ['no-wave', 'No Wave', ['no wave', 'nowave']],
      ['folk-punk', 'Folk Punk', ['folk punk', 'anti folk', 'antifolk']],
      ['ska-punk', 'Ska Punk', ['ska punk']],
    ],
  },
  {
    id: 'metal',
    name: 'Metal',
    bandcamp: ['metal'],
    tags: ['metal', 'avant garde metal', 'experimental metal'],
    subgenres: [
      ['heavy-metal', 'Heavy Metal', ['heavy metal', 'nwobhm', 'traditional heavy metal', 'speed metal']],
      ['black-metal', 'Black Metal', ['black metal', 'atmospheric black metal', 'raw black metal', 'depressive black metal', 'dsbm', 'usbm']],
      ['death-metal', 'Death Metal', ['death metal', 'old school death metal', 'osdm', 'technical death metal', 'brutal death metal', 'melodic death metal']],
      ['doom', 'Doom & Sludge', ['doom', 'doom metal', 'sludge', 'sludge metal', 'funeral doom', 'stoner doom', 'stoner metal', 'drone metal', 'epic doom']],
      ['thrash', 'Thrash', ['thrash', 'thrash metal', 'crossover thrash']],
      ['prog-metal', 'Progressive Metal', ['progressive metal', 'prog metal', 'djent']],
      ['post-metal', 'Post-Metal', ['post metal', 'postmetal', 'atmospheric sludge']],
      ['blackgaze', 'Blackgaze', ['blackgaze', 'post black metal']],
      ['grindcore', 'Grindcore', ['grindcore', 'grind', 'goregrind', 'deathgrind']],
      ['metalcore', 'Metalcore & Deathcore', ['metalcore', 'deathcore', 'mathcore', 'nu metalcore']],
      ['industrial-metal', 'Industrial Metal', ['industrial metal']],
      ['nu-metal', 'Nu Metal', ['rap rock', 'rap metal', 'nu metal', 'numetal']],
    ],
  },
  {
    id: 'hip-hop',
    name: 'Hip Hop',
    bandcamp: ['hip-hop-rap'],
    tags: ['hip hop', 'hiphop', 'rap', 'pop rap', 'hip hop rap', 'rap hip hop', 'underground hip hop', 'alternative hip hop'],
    subgenres: [
      ['abstract-hip-hop', 'Abstract & Experimental Hip Hop', ['industrial hip hop', 'drumless hip hop', 'drumless', 'abstract hip hop', 'experimental hip hop', 'abstract rap', 'experimental rap', 'avant rap']],
      ['boom-bap', 'Boom Bap', ['boom bap', 'boombap', 'east coast hip hop']],
      ['jazz-rap', 'Jazz Rap', ['jazz rap', 'jazz hop', 'jazzhop']],
      ['conscious-hip-hop', 'Conscious Hip Hop', ['hardcore hip hop', 'conscious hip hop', 'political hip hop', 'conscious rap']],
      ['trap', 'Trap', ['trap', 'trap rap', 'plugg', 'pluggnb']],
      ['rage', 'Rage & Cloud Rap', ['rage', 'cloud rap', 'cloud', 'digicore']],
      ['drill', 'Drill', ['drill', 'uk drill', 'chicago drill']],
      ['grime', 'Grime & UK Rap', ['grime', 'uk rap', 'uk hip hop']],
      ['instrumental-hip-hop', 'Instrumental Hip Hop', ['instrumental hip hop', 'beat tape', 'beats', 'lofi hip hop', 'lo fi hip hop']],
      ['southern-hip-hop', 'Southern Hip Hop', ['southern hip hop', 'dirty south', 'memphis rap', 'houston']],
      ['west-coast', 'West Coast Hip Hop', ['west coast hip hop', 'g funk']],
      ['horrorcore', 'Horrorcore', ['horrorcore']],
    ],
  },
  {
    id: 'rnb',
    name: 'R&B & Soul',
    bandcamp: ['r-b-soul', 'funk'],
    tags: ['r and b', 'rnb', 'r b', 'soul', 'r and b soul', 'rhythm and blues', 'soul and funk', 'soul funk'],
    subgenres: [
      ['alt-rnb', 'Alternative R&B', ['alternative r and b', 'alt r and b', 'alternative rnb', 'alt rnb', 'pbr and b', 'experimental r and b']],
      ['contemporary-rnb', 'Contemporary R&B', ['contemporary r and b', 'contemporary rnb']],
      ['neo-soul', 'Neo-Soul', ['neo soul', 'neosoul']],
      ['classic-soul', 'Soul', ['soul', 'northern soul', 'southern soul', 'motown', 'psychedelic soul', 'deep soul']],
      ['funk', 'Funk', ['funk', 'p funk', 'jazz funk', 'deep funk', 'boogie', 'rare groove', 'go go']],
      ['gospel', 'Gospel', ['gospel', 'gospel soul']],
    ],
  },
  {
    id: 'pop',
    name: 'Pop',
    bandcamp: ['pop'],
    tags: ['pop', 'pop music', 'alt pop', 'alternative pop'],
    subgenres: [
      ['art-pop', 'Art Pop', ['progressive pop', 'psychedelic pop', 'art pop', 'artpop', 'experimental pop', 'avant pop']],
      ['synth-pop', 'Synth-Pop', ['synth pop', 'synthpop', 'electropop', 'electro pop', 'new wave', 'synthwave'], ['electronic']],
      ['hyperpop', 'Hyperpop', ['hyperpop', 'hyper pop', 'pc music', 'glitchcore']],
      ['dance-pop', 'Dance-Pop', ['dance pop', 'dancepop', 'electro house pop']],
      ['chamber-pop', 'Chamber & Baroque Pop', ['chamber pop', 'baroque pop', 'orchestral pop']],
      ['sophisti-pop', 'Soft Rock & Sophisti-Pop', ['sophisti pop', 'soft rock', 'yacht rock', 'adult contemporary']],
      ['asian-pop', 'K-Pop, J-Pop & City Pop', ['k pop', 'kpop', 'j pop', 'jpop', 'city pop', 'c pop', 'mandopop', 'cantopop']],
      ['singer-pop', 'Pop Rock', ['pop rock', 'poprock']],
    ],
  },
  {
    id: 'electronic',
    name: 'Electronic',
    bandcamp: ['electronic'],
    tags: ['electronic', 'electronica', 'experimental electronic', 'indietronica', 'electronic music', 'edm', 'dance', 'club', 'dance music', 'beats electronic'],
    subgenres: [
      ['house', 'House', ['house', 'deep house', 'tech house', 'afro house', 'acid house', 'lo fi house', 'outsider house', 'jersey club', 'baltimore club']],
      ['techno', 'Techno', ['techno', 'minimal techno', 'dub techno', 'hard techno', 'industrial techno', 'acid techno', 'ambient techno']],
      ['idm', 'IDM', ['idm', 'intelligent dance music', 'glitch', 'braindance']],
      ['jungle-dnb', 'Jungle & Drum and Bass', ['jungle', 'drum and bass', 'drum bass', 'dnb', 'd and b', 'liquid funk', 'breakcore']],
      ['uk-bass', 'UK Garage & Bass', ['post dubstep', 'uk garage', '2 step', 'uk bass', 'bass music', 'dubstep', 'future garage', 'bassline', 'grime instrumental']],
      ['footwork', 'Footwork & Juke', ['footwork', 'juke', 'ghetto house']],
      ['electro', 'Electro', ['electro', 'electroclash']],
      ['downtempo', 'Downtempo & Trip Hop', ['downtempo', 'trip hop', 'triphop', 'chillout', 'chill out', 'chillwave']],
      ['breakbeat', 'Breakbeat', ['breaks', 'breakbeat', 'big beat']],
      ['trance', 'Trance', ['trance', 'progressive trance', 'psytrance']],
      ['disco', 'Disco & Nu-Disco', ['disco', 'nu disco', 'italo disco', 'italo', 'boogie disco', 'cosmic disco']],
      ['deconstructed-club', 'Deconstructed Club', ['deconstructed club', 'post club', 'experimental club']],
      ['synthwave', 'Synthwave & Vaporwave', ['vaporwave', 'outrun', 'retrowave', 'darksynth']],
      ['chiptune', 'Chiptune', ['chiptune', '8 bit', 'bitpop']],
      ['ebm', 'EBM & Industrial', ['ebm', 'electronic body music', 'industrial', 'aggrotech', 'power electronics'], ['experimental']],
      ['amapiano', 'Amapiano & Gqom', ['amapiano', 'gqom', 'afro tech', 'kuduro'], ['global']],
    ],
  },
  {
    id: 'ambient',
    name: 'Ambient & Drone',
    bandcamp: ['ambient'],
    tags: ['ambient', 'soundscapes', 'soundscape'],
    subgenres: [
      ['ambient', 'Ambient', ['ambient', 'ambient electronic', 'ambient music', 'ambient pop']],
      ['dark-ambient', 'Dark Ambient', ['dark ambient', 'ritual ambient', 'isolationism']],
      ['drone', 'Drone', ['drone', 'drone ambient', 'drones']],
      ['new-age', 'New Age', ['new age', 'newage', 'meditation', 'healing']],
      ['field-recordings', 'Field Recordings', ['field recordings', 'field recording', 'phonography']],
      ['tape-music', 'Tape Music', ['tape music', 'tape loops', 'hauntology']],
    ],
  },
  {
    id: 'experimental',
    name: 'Experimental',
    bandcamp: ['experimental'],
    tags: ['experimental', 'experimental music', 'avant garde', 'avantgarde', 'avant'],
    subgenres: [
      ['noise', 'Noise', ['noise', 'harsh noise', 'harsh noise wall', 'japanoise']],
      ['improvisation', 'Free Improvisation', ['improvisation', 'free improvisation', 'improv', 'improvised music', 'eai']],
      ['sound-art', 'Sound Art & Musique Concrète', ['collage', 'sound art', 'musique concrete', 'electroacoustic', 'electro acoustic', 'acousmatic', 'sound collage', 'plunderphonics']],
      ['avant-garde', 'Avant-Garde', ['avant garde music', 'avant prog', 'rio']],
      ['minimal-music', 'Minimalism', ['minimalism', 'minimal music'], ['classical']],
      ['industrial', 'Industrial', ['industrial music', 'death industrial', 'post industrial'], ['electronic']],
    ],
  },
  {
    id: 'jazz',
    name: 'Jazz',
    bandcamp: ['jazz'],
    tags: ['jazz', 'jazz music', 'modern jazz', 'contemporary jazz'],
    subgenres: [
      ['spiritual-jazz', 'Spiritual Jazz', ['spiritual jazz', 'cosmic jazz']],
      ['free-jazz', 'Free Jazz', ['free jazz', 'avant garde jazz', 'avant jazz', 'free improv jazz']],
      ['jazz-fusion', 'Jazz Fusion', ['fusion', 'jazz fusion', 'jazz rock', 'jazz funk fusion']],
      ['uk-jazz', 'UK & Contemporary Jazz', ['uk jazz', 'london jazz', 'nu jazz', 'nujazz', 'broken beat']],
      ['post-bop', 'Post-Bop & Hard Bop', ['post bop', 'hard bop', 'bebop', 'modal jazz', 'cool jazz', 'swing', 'big band']],
      ['vocal-jazz', 'Vocal Jazz', ['vocal jazz', 'jazz vocals']],
      ['latin-jazz', 'Latin Jazz', ['latin jazz', 'afro cuban jazz', 'ethio jazz', 'ethiojazz'], ['global']],
    ],
  },
  {
    id: 'folk',
    name: 'Folk & Singer-Songwriter',
    bandcamp: ['folk', 'acoustic'],
    tags: ['folk', 'acoustic', 'folk music', 'contemporary folk'],
    subgenres: [
      ['singer-songwriter', 'Singer-Songwriter', ['singer and songwriter', 'singer songwriter', 'songwriter', 'singer songwriter folk']],
      ['indie-folk', 'Indie Folk', ['alternative folk', 'indie folk', 'folk pop', 'pop folk', 'folktronica']],
      ['chamber-folk', 'Chamber & Art Folk', ['chamber folk', 'art folk', 'baroque folk']],
      ['psych-folk', 'Psych & Freak Folk', ['avant folk', 'psych folk', 'psychedelic folk', 'freak folk', 'acid folk', 'experimental folk', 'folk horror']],
      ['trad-folk', 'Traditional Folk', ['traditional', 'traditional folk', 'trad', 'british folk', 'irish folk', 'celtic', 'folk revival']],
      ['american-primitive', 'Fingerstyle & American Primitive', ['american primitive', 'american primitive guitar', 'fingerstyle', 'acoustic guitar', 'solo guitar']],
      ['folk-rock', 'Folk Rock', ['folk rock', 'folkrock']],
    ],
  },
  {
    id: 'country',
    name: 'Country & Americana',
    bandcamp: ['country', 'blues'],
    tags: ['country', 'country music'],
    subgenres: [
      ['alt-country', 'Alt-Country', ['alt country', 'alternative country', 'insurgent country', 'cowpunk', 'country rock']],
      ['americana', 'Americana', ['americana', 'roots', 'roots rock', 'heartland rock']],
      ['bluegrass', 'Bluegrass & Old-Time', ['bluegrass', 'old time', 'old timey', 'appalachian', 'string band']],
      ['classic-country', 'Classic & Outlaw Country', ['outlaw country', 'honky tonk', 'western', 'western swing', 'classic country', 'country western']],
      ['blues', 'Blues', ['blues', 'delta blues', 'country blues', 'electric blues', 'chicago blues', 'hill country blues']],
    ],
  },
  {
    id: 'global',
    name: 'Global',
    bandcamp: ['world', 'latin', 'devotional'],
    tags: ['world', 'world music', 'world fusion', 'global', 'international', 'worldwide', 'reggae and world', 'christian and gospel'],
    subgenres: [
      ['african', 'African', ['african', 'afrobeat', 'afrobeats', 'highlife', 'afro funk', 'afrofunk', 'soukous', 'mbalax', 'ethiopian', 'ethio', 'gnawa', 'tishoumaren', 'desert blues', 'assouf']],
      ['latin', 'Latin', ['latin pop', 'latin', 'latin music', 'latin america', 'cumbia', 'salsa', 'bolero', 'bachata', 'merengue', 'tango', 'son cubano', 'corridos', 'corridos tumbados', 'regional mexican', 'musica mexicana', 'latin rock', 'latin alternative']],
      ['reggaeton', 'Reggaeton & Latin Urban', ['reggaeton', 'dembow', 'latin trap', 'perreo', 'baile funk', 'funk carioca']],
      ['brazilian', 'Brazilian', ['brazilian', 'mpb', 'bossa nova', 'samba', 'tropicalia', 'forro', 'brazil']],
      ['mena', 'Middle East & North Africa', ['arabic', 'middle eastern', 'rai', 'turkish', 'anatolian rock', 'persian', 'maghreb', 'shaabi']],
      ['asian', 'South & East Asian', ['indian classical', 'hindustani', 'carnatic', 'bollywood', 'qawwali', 'gamelan', 'enka', 'thai', 'indonesian', 'luk thung', 'molam']],
      ['caribbean', 'Caribbean', ['caribbean', 'calypso', 'soca', 'kompa', 'zouk', 'compas']],
      ['european-trad', 'European Traditions', ['balkan', 'flamenco', 'fado', 'chanson', 'klezmer', 'polka', 'nordic folk', 'gypsy', 'rembetiko']],
      ['devotional', 'Devotional & Sacred', ['devotional', 'sacred', 'chant', 'byzantine chant', 'spiritual', 'christian', 'worship', 'sufi']],
    ],
  },
  {
    id: 'reggae',
    name: 'Reggae & Dub',
    bandcamp: ['reggae'],
    tags: ['reggae', 'jamaica'],
    subgenres: [
      ['roots-reggae', 'Roots Reggae', ['roots reggae', 'lovers rock', 'rocksteady']],
      ['dub', 'Dub', ['dub', 'dub reggae', 'steppers']],
      ['dancehall', 'Dancehall', ['dancehall', 'ragga', 'bashment']],
      ['ska', 'Ska', ['ska', 'two tone', '2 tone']],
    ],
  },
  {
    id: 'classical',
    name: 'Classical & Contemporary',
    bandcamp: ['classical'],
    tags: ['classical', 'classical music'],
    subgenres: [
      ['modern-classical', 'Modern Classical', ['modern classical', 'contemporary classical', 'neo classical', 'neoclassical', 'post classical', 'new music']],
      ['chamber', 'Chamber Music', ['chamber music', 'string quartet', 'chamber']],
      ['orchestral', 'Orchestral', ['orchestral', 'symphonic', 'orchestra']],
      ['piano', 'Solo Piano', ['piano', 'solo piano', 'classical piano']],
      ['choral', 'Choral & Opera', ['choral', 'opera', 'choir', 'vocal music']],
      ['early-music', 'Early Music & Baroque', ['baroque', 'early music', 'medieval', 'renaissance']],
    ],
  },
  {
    id: 'other',
    name: 'Soundtrack & Other',
    bandcamp: ['soundtrack', 'spoken-word', 'comedy', 'kids', 'podcasts', 'audiobooks'],
    tags: ['soundtrack', 'ost', 'score', 'films games', 'film games', 'spoken'],
    subgenres: [
      ['film-score', 'Film & TV Score', ['film score', 'film music', 'film soundtrack', 'original score', 'tv soundtrack']],
      ['game-music', 'Video Game Music', ['video game music', 'video game', 'game music', 'vgm']],
      ['library-music', 'Library Music', ['library music', 'library']],
      ['spoken-word', 'Spoken Word & Poetry', ['spoken word', 'poetry', 'storytelling']],
      ['comedy', 'Comedy', ['comedy', 'stand up', 'standup']],
    ],
  },
];

// ---------------------------------------------------------------------------
// Lookups built from the tree.
// ---------------------------------------------------------------------------

export function normalize(tag) {
  return String(tag)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\br\s*'?n'?\s*b\b/g, 'r and b')
    .replace(/[-_/.+]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const FAMILY = Object.fromEntries(FAMILIES.map((f) => [f.id, f]));

// subgenre id -> { id, name, family, also: [] }
export const SUBGENRE = {};
// normalized tag -> [{ family, subgenre|null }]
export const ALIAS = {};
// Bandcamp genre slug -> family id
export const BANDCAMP_FAMILY = {};

const addAlias = (tag, entry) => {
  const key = normalize(tag);
  const list = (ALIAS[key] ??= []);
  if (!list.some((e) => e.family === entry.family && e.subgenre === entry.subgenre)) list.push(entry);
};

for (const f of FAMILIES) {
  for (const slug of f.bandcamp) BANDCAMP_FAMILY[slug] = f.id;
  for (const t of f.tags) addAlias(t, { family: f.id, subgenre: null });
  for (const [id, name, aliases, also = []] of f.subgenres) {
    SUBGENRE[id] = { id, name, family: f.id, also };
    for (const a of [name, ...aliases]) addAlias(a, { family: f.id, subgenre: id });
  }
}

// Tags that are never genres. Anything not in ALIAS is ignored anyway; this
// list only keeps the "unmatched" log readable.
const NOISE = [
  /^\d{2,4}s?$/, // years and decades
  /^(seen live|favorites?|favourite|albums? i own|my music|check out|awesome|love|beautiful|amazing|best|good)$/,
  /^(female|male) (vocalists?|vocals?|fronted)$/,
  /^(vocals?|instrumental|guitar|bass|drums|synth|synthesizer|piano|saxophone|cello|violin)$/,
  /^(chill|sad|melancholic|melancholy|dark|happy|dreamy|mellow|energetic|relaxing|atmospheric|moody|heavy)$/,
  /^(english|spanish|french|german|japanese|portuguese|italian)$/,
  /^(debut|debut album|cassette|vinyl|lp|ep|album|demo|live|compilation|reissue|remastered)$/,
];
export const isNoise = (key) => NOISE.some((re) => re.test(key));
