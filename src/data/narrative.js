// Room identities are stable even if their presentation changes.
export const SOUVENIRS = [
  { level: 1, id: 'pencilCase', nameKey: 'souvenir.1', shape: 'box', slot: 'desk' },
  { level: 2, id: 'halfBowl', nameKey: 'souvenir.2', shape: 'bowl', slot: 'shelf' },
  { level: 3, id: 'collar', nameKey: 'souvenir.3', shape: 'collar', slot: 'window' },
  { level: 4, id: 'workBadge', nameKey: 'souvenir.4', shape: 'badge', slot: 'hook' },
  { level: 5, id: 'foldedCloth', nameKey: 'souvenir.5', shape: 'cloth', slot: 'lamp' },
];
export const AFTER_STORIES = SOUVENIRS.map(({ level }) => ({ level, textKey: `after.${level}` }));
export const CODEX_FIELDS = ['identify', 'warning', 'opening', 'counter'];
export const SPECIES_NOTES = Object.fromEntries(['fry','lantern','manta','royal','abyss','jelly','tapir','guard','nightmare'].map(kind =>
  [kind, Object.fromEntries(CODEX_FIELDS.map(field => [field, `codex.${kind}.${field}`]))]));
