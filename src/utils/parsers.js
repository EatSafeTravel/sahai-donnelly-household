// Strip everything that isn't the meal name: times in parens, markdown bold,
// leading/trailing dashes, em-dashes, colons, numbered prefixes like "1."
function cleanName(str) {
  return str
    .replace(/\([^)]*\)/g, '')        // remove all (...) including time
    .replace(/\*\*/g, '')              // remove bold markdown
    .replace(/^\*+|\*+$/g, '')         // remove surrounding asterisks
    .replace(/^\s*[\d]+[.)]\s*/, '')   // remove leading "1. " or "1) "
    .replace(/^[\s\-–—:]+/, '')        // remove leading dashes / colons
    .replace(/[\s\-–—:]+$/, '')        // remove trailing dashes / colons
    .trim();
}

// Parse each line looking for: Day: Option1 / Option2 / Option3
// Also handles **Day:** (bold markdown) and em-dashes as separators
export function parseMealOptionsFromReply(text) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const options = {};

  days.forEach(d => {
    const regex = new RegExp(`\\*{0,2}${d}(?:day)?\\*{0,2}\\s*[:\\-–—]+\\s*([^\\n]+)`, 'i');
    const m = text.match(regex);
    if (!m) return;

    const parts = m[1].split('/').map(part => {
      const timeMatch = part.match(/\(([^)]+)\)/);
      const name = cleanName(part);
      const time = timeMatch ? timeMatch[1].trim() : '';
      return { name, time };
    }).filter(p => p.name && p.name.length > 1 && p.name.length < 100);

    if (parts.length > 0) options[d] = parts;
  });

  return Object.keys(options).length > 0 ? options : null;
}

// Re-uses parseMealOptionsFromReply and takes the first option per day
export function parseMealsFromReply(text, state) {
  const allOptions = parseMealOptionsFromReply(text);
  if (!allOptions) return null;

  let changed = false;
  const meals = state.meals.map(m => {
    const opts = allOptions[m.day];
    if (!opts?.[0]?.name) return m;
    changed = true;
    return { ...m, name: opts[0].name, time: opts[0].time || m.time };
  });

  return changed ? meals : null;
}

// Words that indicate a line is AI commentary, not a grocery item
const COMMENTARY_SIGNALS = [
  'this week', 'no fish', 'no nuts', 'no meat', 'no seafood', 'no finned',
  'great for', 'good for', 'option', 'inspired', 'free —', 'free-', '*(', ')*',
  'ronan', 'parul', 'mira', 'kian', 'every night', 'every single',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

function isGroceryItem(name) {
  const lower = name.toLowerCase();
  // Reject if it contains commentary signals
  if (COMMENTARY_SIGNALS.some(s => lower.includes(s))) return false;
  // Reject if it contains asterisks (AI annotation markers)
  if (name.includes('*')) return false;
  // Reject if it looks like a sentence (contains common sentence patterns)
  if (/\b(are|is|was|used|assigned|inspired|options?|week|night)\b/.test(lower)) return false;
  // Reject items that are suspiciously long (real grocery items are short)
  if (name.length > 45) return false;
  return true;
}

export function parseShopFromReply(text, state) {
  const catMap = {
    produce: 'Produce', fresh: 'Produce', vegetables: 'Produce', fruit: 'Produce',
    meat: 'Meat & fish', fish: 'Meat & fish', seafood: 'Meat & fish',
    pantry: 'Pantry', dry: 'Pantry', staples: 'Pantry', cupboard: 'Pantry',
    dairy: 'Dairy', eggs: 'Dairy',
    frozen: 'Frozen',
    other: 'Other', bakery: 'Other', herbs: 'Other',
  };

  // Always start with empty categories so we replace rather than accumulate
  const shop = {};
  Object.keys(state.shop).forEach(cat => { shop[cat] = []; });

  const lines = text.split('\n');
  let currentCat = 'Other';
  let changed = false;

  lines.forEach(line => {
    const catMatch = Object.keys(catMap).find(
      k => line.toLowerCase().includes(k) && line.includes(':')
    );
    if (catMatch) { currentCat = catMap[catMatch]; return; }

    const itemMatch = line.match(/^[-•*]\s+(.+?)(?:\s*[-–]\s*(.+?))?(?:\s*\((.+?)\))?$/);
    if (itemMatch) {
      const name = (itemMatch[1] || '').replace(/\*\*/g, '').replace(/\*/g, '').trim();
      const qty = (itemMatch[2] || itemMatch[3] || '').replace(/\*/g, '').trim();
      if (
        name &&
        isGroceryItem(name) &&
        !shop[currentCat]?.find(i => i.name.toLowerCase() === name.toLowerCase())
      ) {
        if (!shop[currentCat]) shop[currentCat] = [];
        shop[currentCat].push({ name, qty, done: false });
        changed = true;
      }
    }
  });

  return changed ? shop : null;
}
