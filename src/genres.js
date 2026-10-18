// Genre helpers: turn ids from the picker's taxonomy into display tags and
// filters. Old entries without `genres` simply have no tags.
import { FAMILY, SUBGENRE } from '../scripts/picker/taxonomy.mjs';

const fam = (id) => (FAMILY[id] ? { id, name: FAMILY[id].name, kind: 'family' } : null);
const sub = (id) => (SUBGENRE[id] ? { id, name: SUBGENRE[id].name, kind: 'sub', family: SUBGENRE[id].family } : null);

// -> { primary: tag|null, secondary: [tag], subs: [tag] }
export function tagsOf(genres) {
  const g = genres ?? {};
  return {
    primary: fam(g.primary),
    secondary: (g.secondary ?? []).map(fam).filter(Boolean),
    subs: (g.subgenres ?? []).map(sub).filter(Boolean),
  };
}

export const hasGenres = (t) => Boolean(t.primary || t.secondary.length || t.subs.length);

// A filter id is either a family or a subgenre; anything else is ignored.
export function resolveFilter(id) {
  if (FAMILY[id]) return { id, family: id, sub: null };
  if (SUBGENRE[id]) return { id, family: SUBGENRE[id].family, sub: id };
  return null;
}

export const inFamily = (entry, familyId) => {
  const g = entry.genres ?? {};
  return g.primary === familyId || (g.secondary ?? []).includes(familyId);
};
export const inSub = (entry, subId) => (entry.genres?.subgenres ?? []).includes(subId);
