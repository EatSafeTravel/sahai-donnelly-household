import { useState, useRef, useEffect } from 'react';
import Anthropic from '@anthropic-ai/sdk';
import ReactMarkdown from 'react-markdown';
import { useHouseholdState } from '../context/StateContext';
import { parseMealsFromReply, parseMealOptionsFromReply, parseShopFromReply } from '../utils/parsers';

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY || '',
  dangerouslyAllowBrowser: true,
});

function buildSystemPrompt(state) {
  const mealOptions = state.mealOptions || {};
  const mealsStr = state.meals.map(m => {
    if (m.skip) return `${m.day}: NOT HOME — family is out, do not plan`;
    const base = `${m.day}: ${m.name || '(not yet planned)'}${m.time ? ` (${m.time})` : ''}`;
    const alts = mealOptions[m.day]?.slice(1).map(o => o.name).filter(Boolean) || [];
    return alts.length ? `${base}  [unused alternatives: ${alts.join(' / ')}]` : base;
  }).join('\n');

  const library = state.mealLibrary || [];
  const libraryStr = library.length
    ? library.map(m => `  - ${m.name}${m.time ? ` (${m.time})` : ''}`).join('\n')
    : '  (none saved yet)';

  const shopStr = Object.entries(state.shop)
    .map(([cat, items]) => `${cat}: ${items.map(i => i.name + (i.done ? ' (checked)' : '')).join(', ') || 'empty'}`)
    .join('\n');
  const ptsStr = state.kids
    .map(k => `${k}: ${state.scores[k] || 0} total, ${state.weekScores[k] >= 0 ? '+' : ''}${state.weekScores[k] || 0} this week`)
    .join(', ');

  const profiles = state.profiles || {};
  const adultNames = Object.keys(profiles).filter(n => profiles[n]?.role === 'adult');
  const allNames = [...state.kids, ...adultNames];

  const memberLines = allNames.map(n => {
    const p = profiles[n];
    const role = p?.role === 'adult' ? 'adult' : p?.age ? `child, age ${p.age}` : 'child';
    return `  - ${n} (${role})`;
  }).join('\n') || `  - ${state.kids.join(', ')}`;

  const allergyLines = allNames
    .filter(n => profiles[n]?.allergies?.length)
    .map(n => `  - ${n}: ${profiles[n].allergies.join(', ')} — STRICT, never serve, even trace amounts`)
    .join('\n') || '  None';

  const dislikeLines = allNames
    .filter(n => profiles[n]?.dislikes?.length)
    .map(n => `  - ${n}: ${profiles[n].dislikes.join(', ')}`)
    .join('\n') || '  None';

  const noteLines = allNames
    .filter(n => profiles[n]?.notes)
    .map(n => `  - ${n}: ${profiles[n].notes}`)
    .join('\n') || '  None';

  return `You are a friendly household management agent for a family. You help with weekly meal planning, shopping lists, and cooperation points for children.

FAMILY MEMBERS:
${memberLines}

ALLERGIES — STRICT CONSTRAINTS (never serve, even trace amounts):
${allergyLines}

DISLIKES — SOFT PREFERENCES (avoid where possible):
${dislikeLines}

NOTES:
${noteLines}

MEAL PREFERENCES:
- Favourite cuisines: ${state.prefs.cuisines || 'varied'}
- Weeknight time budget: ${state.prefs.time}
- Weekend cooking: ${state.prefs.weekend}
- Foods to avoid/rotate: ${state.prefs.avoid || 'none'}
- Custom point rules: ${state.prefs.ptsRules || 'none'}

MEAL LIBRARY (family favourites to draw from when planning):
${libraryStr}

CURRENT MEAL PLAN (days marked NOT HOME should be skipped; alternatives shown are already generated but not yet chosen):
${mealsStr}

SHOPPING LIST:
${shopStr}

COOPERATION POINTS:
${ptsStr}

RECENT LOG:
${state.log.slice(-5).map(l => `${l.kid}: ${l.reason} (${l.pts > 0 ? '+' : ''}${l.pts})`).join('\n') || 'No recent entries'}

MEAL PLANNING FORMAT — always use this exact format when planning meals:
Mon: Meat version (time) / Fish version (time) / Different meal entirely (time)
Give 3 options per day separated by " / ":
- Option 1: the main family meal with a meat protein (for Kian and Mira)
- Option 2: the SAME dish as option 1 but swapping the meat for a fish protein (for Parul) — same base, same sides, same cooking method, different protein only
- Option 3: a completely different meal as an alternative for the whole family
This lets the family cook one shared meal base with two proteins side by side.

SHOPPING LIST FORMAT — organise by: Produce, Meat & fish, Pantry, Dairy, Frozen, Other
Be warm, practical, and family-friendly. Keep responses concise but helpful.`;
}

const QUICK_PROMPTS = [
  { label: 'Generate shopping list', text: 'Generate a shopping list from the current meal plan' },
  { label: 'Recipe cards', text: "Generate a recipe card for each dinner in this week's meal plan. For each include: serves 4, ingredients with quantities, and numbered steps. Keep it practical and brief." },
  { label: 'Review points', text: "Summarise this week's cooperation points and suggest if any rewards should be awarded" },
  { label: 'New reward ideas', text: 'Suggest 3 new reward ideas appropriate for kids aged 6–12' },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DEFAULT_DINNER_DAYS = ['Mon', 'Tue', 'Wed', 'Thu'];

function DinnerPlanForm({ homeDays, mealLibrary, disabled, onSubmit, onCancel }) {
  const [selectedDays, setSelectedDays] = useState(
    DEFAULT_DINNER_DAYS.filter(d => homeDays.includes(d))
  );
  const [dayMeals, setDayMeals] = useState({});   // { Mon: { name, time } }
  const [pickerDay, setPickerDay] = useState(null); // which day's picker is open

  function toggleDay(day) {
    setSelectedDays(prev => {
      const next = prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day];
      return next;
    });
    if (selectedDays.includes(day)) {
      setDayMeals(prev => { const n = { ...prev }; delete n[day]; return n; });
    }
  }

  function assignMeal(day, meal) {
    setDayMeals(prev => ({ ...prev, [day]: meal }));
    setPickerDay(null);
  }

  function clearMeal(day) {
    setDayMeals(prev => { const n = { ...prev }; delete n[day]; return n; });
  }

  const ordered = DAYS.filter(d => selectedDays.includes(d));
  const picked = ordered.filter(d => dayMeals[d]);
  const toGenerate = ordered.filter(d => !dayMeals[d]);

  return (
    <div className="dinner-plan-form">
      <div className="dinner-plan-label">Which days do you need dinner?</div>
      <div className="dinner-plan-days">
        {DAYS.map(day => (
          <button
            key={day}
            className={`dinner-day-btn${selectedDays.includes(day) ? ' active' : ''}`}
            onClick={() => toggleDay(day)}
            type="button"
          >
            {day}
          </button>
        ))}
      </div>

      {ordered.length > 0 && mealLibrary.length > 0 && (
        <div className="dinner-day-assignments">
          <div className="dinner-plan-label">Pick from favourites, or leave for Claude to suggest:</div>
          {ordered.map(day => (
            <div key={day} className="dinner-day-row">
              <span className="dinner-day-name">{day}</span>
              {dayMeals[day] ? (
                <span className="dinner-assigned-meal">
                  ★ {dayMeals[day].name}
                  <button onClick={() => clearMeal(day)}>×</button>
                </span>
              ) : (
                <button
                  className="dinner-pick-btn"
                  onClick={() => setPickerDay(pickerDay === day ? null : day)}
                >
                  {pickerDay === day ? 'Close ▲' : '+ from favourites ▾'}
                </button>
              )}
              {pickerDay === day && (
                <div className="dinner-fav-picker">
                  {mealLibrary.map((meal, i) => (
                    <button key={i} className="dinner-fav-chip" onClick={() => assignMeal(day, meal)}>
                      {meal.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="dinner-plan-footer">
        <span className="text-mid">
          {ordered.length} dinner{ordered.length !== 1 ? 's' : ''}
          {picked.length > 0 && ` · ${picked.length} from favourites`}
          {toGenerate.length > 0 && picked.length > 0 && ` · ${toGenerate.length} new`}
        </span>
        <button className="btn btn-sm" onClick={onCancel}>Cancel</button>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => onSubmit(ordered, dayMeals)}
          disabled={disabled || ordered.length === 0}
        >
          Plan {ordered.length} dinner{ordered.length !== 1 ? 's' : ''} →
        </button>
      </div>
    </div>
  );
}

export default function AgentTab({ onQuickSend, pendingMsg, onPendingMsgConsumed }) {
  const { state, save } = useHouseholdState();
  const [messages, setMessages] = useState([
    { role: 'ai', text: "Hi! I'm your household agent. I can plan your meals, build a shopping list, and help manage cooperation points each week. Use Run weekly setup for a full one-click refresh, or ask me anything below." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [planningOpen, setPlanningOpen] = useState(false);
  const chatRef = useRef(null);
  // Keep a ref to always have the latest state inside async functions
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (pendingMsg) {
      onPendingMsgConsumed();
      sendMsg(pendingMsg);
    }
  }, [pendingMsg]);

  function addMsg(text, role) {
    setMessages(prev => [...prev, { role, text }]);
  }

  async function callClaude(userPrompt, workingState, maxTokens = 1000) {
    const resp = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: buildSystemPrompt(workingState),
      messages: [{ role: 'user', content: userPrompt }],
    });
    return resp.content.map(b => b.text || '').join('\n').trim() || 'No response.';
  }

  async function sendMsg(text) {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    addMsg(msg, 'user');
    setLoading(true);

    const currentState = stateRef.current;
    const history = [...currentState.chatHistory, { role: 'user', content: msg }].slice(-20);

    try {
      const resp = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: buildSystemPrompt(currentState),
        messages: history,
      });
      const reply = resp.content.map(b => b.text || '').join('\n').trim() || 'Sorry, I had trouble with that.';
      addMsg(reply, 'ai');

      const newHistory = [...history, { role: 'assistant', content: reply }].slice(-20);
      const patch = { chatHistory: newHistory };
      const parsedMeals = parseMealsFromReply(reply, currentState);
      if (parsedMeals) patch.meals = parsedMeals;
      const parsedOptions = parseMealOptionsFromReply(reply);
      if (parsedOptions) patch.mealOptions = { ...(currentState.mealOptions || {}), ...parsedOptions };
      const parsedShop = parseShopFromReply(reply, currentState);
      if (parsedShop) patch.shop = parsedShop;
      save(patch);
    } catch {
      addMsg('Network error — please check your API key and try again.', 'ai');
    }
    setLoading(false);
  }

  async function runWeeklySetup() {
    if (loading) return;
    setLoading(true);

    // snapshot state at start; updated locally as each step applies changes
    let ws = { ...stateRef.current };

    try {
      // ── Step 1: Points summary + reset ──────────────────────────────
      addMsg('Step 1 / 5  ·  Summarising cooperation points…', 'step');
      const ptsSummary = await callClaude(
        `Summarise this week's cooperation points for each child. Be warm and encouraging — mention any standout behaviours from the recent log if there are any. End by confirming that weekly scores are now reset to zero ready for the fresh week ahead.`,
        ws
      );
      addMsg(ptsSummary, 'ai');
      const weekScores = {};
      ws.kids.forEach(k => { weekScores[k] = 0; });
      ws = { ...ws, weekScores };
      save({ weekScores });

      // ── Step 2: Plan meals ───────────────────────────────────────────
      addMsg("Step 2 / 5  ·  Planning this week's dinners…", 'step');
      const mealReply = await callClaude(
        `Plan 7 dinners for this week. Strictly respect all allergies. Avoid dislikes where possible. Use the family's favourite cuisines and time budget. Every meal must include a protein — meat for the children, fish options for Parul. For each day give 3 options: Mon: Option 1 (time) / Option 2 (time) / Option 3 (time). Include at least 2 quick weeknight meals under 30 minutes.`,
        ws,
        1400
      );
      addMsg(mealReply, 'ai');
      const parsedMeals = parseMealsFromReply(mealReply, ws);
      const parsedOptions = parseMealOptionsFromReply(mealReply);
      if (parsedMeals) ws = { ...ws, meals: parsedMeals };
      if (parsedOptions) ws = { ...ws, mealOptions: parsedOptions };
      if (parsedMeals || parsedOptions) save({ meals: ws.meals, mealOptions: ws.mealOptions });

      // ── Step 3: Shopping list ────────────────────────────────────────
      addMsg('Step 3 / 5  ·  Building shopping list…', 'step');
      const mealsForPrompt = ws.meals.map(m => `${m.day}: ${m.name}`).join(', ');
      const shopReply = await callClaude(
        `Generate a complete shopping list for this week's meal plan: ${mealsForPrompt}. Organise by category: Produce, Meat & fish, Pantry, Dairy, Frozen, Other. Format each item as: - Item name - quantity`,
        ws,
        1200
      );
      addMsg(shopReply, 'ai');
      const parsedShop = parseShopFromReply(shopReply, ws);
      if (parsedShop) { ws = { ...ws, shop: parsedShop }; save({ shop: parsedShop }); }

      // ── Step 4: Recipe cards ─────────────────────────────────────────
      addMsg('Step 4 / 5  ·  Writing recipe cards…', 'step');
      const plannedMeals = ws.meals.filter(m => m.name && !m.skip);
      const recipeReply = await callClaude(
        `Generate a concise recipe card for each of these dinners: ${plannedMeals.map(m => m.name).join(', ')}. For each recipe include: serves 4, ingredients with quantities, and clear numbered steps. Keep it practical and brief. Remember Mira has a nut allergy — flag any ingredients to watch.`,
        ws,
        2000
      );
      addMsg(recipeReply, 'ai');

      // ── Step 5: Done ─────────────────────────────────────────────────
      addMsg('Step 5 / 5  ·  All done!', 'step');
      addMsg(
        "Weekly setup complete! Here's what was updated:\n\n• Cooperation points summarised and weekly scores reset to zero\n• Dinners planned for the week\n• Shopping list generated and organised by aisle\n• Recipe cards written for each meal\n\nHead to the Meals and Shopping tabs to review everything. Have a great week!",
        'ai'
      );
    } catch (e) {
      addMsg(`Setup stopped — ${e.message || 'network error. Please try again.'}`, 'ai');
    }

    setLoading(false);
  }

  function quickSend(text) {
    onQuickSend();
    sendMsg(text);
  }

  return (
    <div className="panel">
      {/* Weekly setup banner */}
      <div className="setup-banner">
        <div className="setup-banner-text">
          <div className="setup-banner-title">Weekly household setup</div>
          <div className="setup-banner-sub">Summarise points · Plan 7 meals · Generate shopping list</div>
        </div>
        <button className="setup-banner-btn" onClick={runWeeklySetup} disabled={loading}>
          {loading ? <><span className="spinner" style={{ borderTopColor: 'var(--green)' }}></span>Running…</> : '▶  Run weekly setup'}
        </button>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="badge"></span>
          <span className="card-title">Household agent</span>
          <span className="text-mid ml-auto">Powered by Claude</span>
        </div>
        <div className="card-body">
          <div className="quick-prompts">
            <button
              className="quick-btn"
              onClick={() => setPlanningOpen(o => !o)}
              disabled={loading}
            >
              Plan dinners for the week
            </button>
            {QUICK_PROMPTS.map(p => (
              <button key={p.label} className="quick-btn" onClick={() => quickSend(p.text)} disabled={loading}>{p.label}</button>
            ))}
          </div>

          {planningOpen && (() => {
            const skipped = state.meals.filter(m => m.skip).length;
            const homeDays = state.meals.filter(m => !m.skip).map(m => m.day);
            const defaultCount = Math.max(1, 7 - skipped);
            return (
              <DinnerPlanForm
                homeDays={homeDays}
                mealLibrary={state.mealLibrary || []}
                disabled={loading}
                onSubmit={(days, dayMeals) => {
                  setPlanningOpen(false);

                  // Apply pre-picked favourites to the meal plan immediately
                  const picked = days.filter(d => dayMeals[d]);
                  if (picked.length > 0) {
                    const meals = stateRef.current.meals.map(m =>
                      dayMeals[m.day] ? { ...m, name: dayMeals[m.day].name, time: dayMeals[m.day].time || '' } : m
                    );
                    save({ meals });
                  }

                  const toGenerate = days.filter(d => !dayMeals[d]);

                  if (toGenerate.length === 0) {
                    // All days chosen from favourites — no Claude call needed
                    addMsg(picked.map(d => `${d}: ${dayMeals[d].name}`).join('\n'), 'user');
                    addMsg(`Applied ${picked.length} meal${picked.length !== 1 ? 's' : ''} from your favourites. Head to the Meals tab to review.`, 'ai');
                    return;
                  }

                  const pickedNote = picked.length > 0
                    ? ` We've already chosen from favourites — ${picked.map(d => `${d}: ${dayMeals[d].name}`).join(', ')}. Do NOT output those days.`
                    : '';

                  sendMsg(`Plan dinners for ${toGenerate.join(', ')}.${pickedNote} For each day give 3 options: Day: Option 1 (time) / Option 2 (time) / Option 3 (time). Every meal must include a protein. Meat for the children, fish options for Parul. Include variety.`);
                }}
                onCancel={() => setPlanningOpen(false)}
              />
            );
          })()}
          <div className="agent-chat" ref={chatRef}>
            {messages.map((m, i) => (
              <div key={i} className={`msg msg-${m.role}`}>
                {m.role === 'ai'
                  ? <div className="md"><ReactMarkdown>{m.text}</ReactMarkdown></div>
                  : m.text}
              </div>
            ))}
            {loading && <div className="msg msg-ai thinking">Thinking…</div>}
          </div>
          <div className="chat-input-row">
            <input
              className="chat-input"
              placeholder="Ask me anything about this week…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMsg()}
              disabled={loading}
            />
            <button className="btn btn-primary" onClick={() => sendMsg()} disabled={loading}>
              {loading ? <><span className="spinner"></span>Thinking</> : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
