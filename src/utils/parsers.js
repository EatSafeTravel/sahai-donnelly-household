export function parseMealsFromReply(text, state) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const meals = state.meals.map(m => ({ ...m }));
  let changed = false;

  days.forEach((d, i) => {
    const regex = new RegExp(`${d}(day)?[:\\s-]+([^(\\n]+?)(?:\\(([^)]+)\\))?(?:\\n|$)`, 'i');
    const m = text.match(regex);
    if (m) {
      const name = m[2].trim().replace(/^\*+|\*+$/g, '').replace(/\*\*/g, '');
      const time = m[3] || '';
      if (name && name.length < 80) {
        meals[i] = { day: d, name, time };
        changed = true;
      }
    }
  });

  return changed ? meals : null;
}

export function parseShopFromReply(text, state) {
  const catMap = {
    produce: 'Produce', fresh: 'Produce',
    meat: 'Meat & fish', fish: 'Meat & fish',
    pantry: 'Pantry', dry: 'Pantry',
    dairy: 'Dairy', eggs: 'Dairy',
    frozen: 'Frozen',
    other: 'Other',
  };

  const shop = {};
  Object.keys(state.shop).forEach(cat => {
    shop[cat] = [...state.shop[cat]];
  });

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
      const name = (itemMatch[1] || '').replace(/\*\*/g, '').trim();
      const qty = (itemMatch[2] || itemMatch[3] || '').trim();
      if (
        name && name.length < 60 &&
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
