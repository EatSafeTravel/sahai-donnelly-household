export const DEFAULT_STATE = {
  kids: ['Kian', 'Mira'],
  scores: { Kian: 0, Mira: 0 },
  weekScores: { Kian: 0, Mira: 0 },
  log: [],
  meals: [
    { day: 'Mon', name: '', time: '' },
    { day: 'Tue', name: '', time: '' },
    { day: 'Wed', name: '', time: '' },
    { day: 'Thu', name: '', time: '' },
    { day: 'Fri', name: '', time: '' },
    { day: 'Sat', name: '', time: '' },
    { day: 'Sun', name: '', time: '' },
  ],
  mealOptions: {},   // { Mon: [{name, time}, ...], Tue: [...], ... }
  mealLibrary: [],   // [{ name, time }]
  shop: {
    Produce: [],
    'Meat & fish': [],
    Pantry: [],
    Dairy: [],
    Frozen: [],
    Other: [],
  },
  rewards: [
    { pts: 5, label: '30 min extra TV' },
    { pts: 10, label: '1 hr computer games' },
    { pts: 15, label: 'Stay up 30 min later' },
    { pts: 20, label: 'Choose Friday dinner' },
    { pts: 25, label: 'Movie night pick' },
    { pts: 35, label: 'Friend sleepover' },
  ],
  profiles: {
    Kian: { role: 'child', age: null, allergies: [], dislikes: [], notes: 'Prefers meat as protein' },
    Mira: { role: 'child', age: null, allergies: ['nuts'], dislikes: [], notes: 'Prefers meat as protein' },
    Parul: { role: 'adult', age: null, allergies: [], dislikes: [], notes: 'Prefers fish as protein' },
    Ronan: { role: 'adult', age: null, allergies: [], dislikes: [], notes: '' },
  },
  prefs: {
    cuisines: '',
    time: '30–45 min',
    weekend: 'Happy to cook more',
    avoid: '',
    ptsRules: '',
    planningStyle: 'family-veggie',
    planningCustom: '',
    recipeInspiration: 'NYT Cooking — draw on recipes by Melissa Clark, Sam Sifton, and Ali Slagle',
  },
  mealHistory: [], // [{ week: 'YYYY-WW', meals: ['Meal 1', ...] }] — rolling 4-week archive
  mealNotes: '',
  lastMealDay: 'Monday',
  chatHistory: [],
};
