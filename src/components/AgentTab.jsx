import { useState, useRef, useEffect } from 'react';
import Anthropic from '@anthropic-ai/sdk';
import { useHouseholdState } from '../context/StateContext';
import { parseMealsFromReply, parseShopFromReply } from '../utils/parsers';

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY || '',
  dangerouslyAllowBrowser: true,
});

function buildSystemPrompt(state) {
  const mealsStr = state.meals
    .map(m => `${m.day}: ${m.name || '(empty)'} — ${m.time || ''}`)
    .join('\n');
  const shopStr = Object.entries(state.shop)
    .map(([cat, items]) => `${cat}: ${items.map(i => i.name + (i.done ? ' (checked)' : '')).join(', ')}`)
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

CURRENT MEAL PLAN:
${mealsStr}

SHOPPING LIST:
${shopStr}

COOPERATION POINTS:
${ptsStr}

RECENT LOG:
${state.log.slice(-5).map(l => `${l.kid}: ${l.reason} (${l.pts > 0 ? '+' : ''}${l.pts})`).join('\n') || 'No recent entries'}

When you plan meals, output them in a clear list: Mon: [meal name] ([time])
When you generate a shopping list, organise by category: Produce, Meat & fish, Pantry, Dairy, Frozen, Other
Be warm, practical, and family-friendly. Keep responses concise but helpful.`;
}

const QUICK_PROMPTS = [
  { label: "Plan this week's meals", text: 'Plan 7 dinners for this week, with variety and at least 2 quick meals under 30 minutes' },
  { label: 'Generate shopping list', text: 'Generate a shopping list from the current meal plan' },
  { label: 'Review points', text: "Summarise this week's cooperation points and suggest if any rewards should be awarded" },
  { label: 'New reward ideas', text: 'Suggest 3 new reward ideas appropriate for kids aged 6–12' },
];

export default function AgentTab({ onQuickSend, pendingMsg, onPendingMsgConsumed }) {
  const { state, save } = useHouseholdState();
  const [messages, setMessages] = useState([
    { role: 'ai', text: "Hi! I'm your household agent. I can plan your meals, build a shopping list, and help manage cooperation points each week. Use Run weekly setup for a full one-click refresh, or ask me anything below." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
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
      addMsg('Step 1 / 4  ·  Summarising cooperation points…', 'step');
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
      addMsg("Step 2 / 4  ·  Planning this week's dinners…", 'step');
      const mealReply = await callClaude(
        `Plan 7 dinners for this week. Strictly respect all allergies. Avoid dislikes where possible. Use the family's favourite cuisines and time budget. Format each meal as: Mon: [meal name] ([time]). Include at least 2 quick weeknight meals under 30 minutes.`,
        ws,
        1200
      );
      addMsg(mealReply, 'ai');
      const parsedMeals = parseMealsFromReply(mealReply, ws);
      if (parsedMeals) { ws = { ...ws, meals: parsedMeals }; save({ meals: parsedMeals }); }

      // ── Step 3: Shopping list ────────────────────────────────────────
      addMsg('Step 3 / 4  ·  Building shopping list…', 'step');
      const mealsForPrompt = ws.meals.map(m => `${m.day}: ${m.name}`).join(', ');
      const shopReply = await callClaude(
        `Generate a complete shopping list for this week's meal plan: ${mealsForPrompt}. Organise by category: Produce, Meat & fish, Pantry, Dairy, Frozen, Other. Format each item as: - Item name - quantity`,
        ws,
        1200
      );
      addMsg(shopReply, 'ai');
      const parsedShop = parseShopFromReply(shopReply, ws);
      if (parsedShop) { ws = { ...ws, shop: parsedShop }; save({ shop: parsedShop }); }

      // ── Step 4: Done ─────────────────────────────────────────────────
      addMsg('Step 4 / 4  ·  All done!', 'step');
      addMsg(
        "Weekly setup complete! Here's what was updated:\n\n• Cooperation points summarised and weekly scores reset to zero\n• 7 dinners planned for the week\n• Shopping list generated and organised by aisle\n\nHead to the Meals and Shopping tabs to review everything. Have a great week!",
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
            {QUICK_PROMPTS.map(p => (
              <button key={p.label} className="quick-btn" onClick={() => quickSend(p.text)} disabled={loading}>{p.label}</button>
            ))}
          </div>
          <div className="agent-chat" ref={chatRef}>
            {messages.map((m, i) => (
              <div key={i} className={`msg msg-${m.role}`}>{m.text}</div>
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
