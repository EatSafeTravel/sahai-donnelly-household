import { useState } from 'react';
import { useHouseholdState } from '../context/StateContext';
import { PLANNING_STYLES } from './AgentTab';

// ── Profile card for one family member ────────────────────────────────────────
function ProfileCard({ name, profile, onUpdate, onRemove, isKid }) {
  const [allergyInput, setAllergyInput] = useState('');
  const [dislikeInput, setDislikeInput] = useState('');

  function addTag(field, input, setInput) {
    const val = input.trim();
    if (!val) return;
    const current = profile[field] || [];
    if (!current.includes(val)) onUpdate({ [field]: [...current, val] });
    setInput('');
  }

  function removeTag(field, tag) {
    onUpdate({ [field]: (profile[field] || []).filter(t => t !== tag) });
  }

  return (
    <div className="profile-card">
      <div className="profile-card-head">
        <input
          className="profile-name-input"
          defaultValue={name}
          onBlur={e => e.target.value.trim() && e.target.value !== name && onUpdate({ _rename: e.target.value.trim() })}
          title="Click to rename"
        />
        <span className={`tag ${profile.role === 'adult' ? 'tag-amber' : 'tag-green'}`}>
          {profile.role === 'adult' ? 'Adult' : 'Child'}
        </span>
        {profile.role === 'child' && (
          <input
            className="profile-age-input"
            type="number"
            placeholder="age"
            min="1" max="18"
            value={profile.age || ''}
            onChange={e => onUpdate({ age: parseInt(e.target.value) || null })}
          />
        )}
        {!isKid && (
          <button className="btn btn-sm btn-danger" style={{ marginLeft: 'auto' }} onClick={onRemove}>×</button>
        )}
      </div>

      <div className="profile-card-body">
        {/* Allergies */}
        <div>
          <label style={{ marginBottom: 6 }}>Allergies</label>
          <div className="tag-row">
            {(profile.allergies || []).map(a => (
              <span key={a} className="tag-pill tag-pill-red">
                {a}
                <button className="tag-pill-remove" onClick={() => removeTag('allergies', a)}>×</button>
              </span>
            ))}
            <input
              className="tag-inline-input"
              placeholder="Add allergy…"
              value={allergyInput}
              onChange={e => setAllergyInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { addTag('allergies', allergyInput, setAllergyInput); e.preventDefault(); } }}
              onBlur={() => addTag('allergies', allergyInput, setAllergyInput)}
            />
          </div>
        </div>

        {/* Dislikes */}
        <div>
          <label style={{ marginBottom: 6 }}>Dislikes</label>
          <div className="tag-row">
            {(profile.dislikes || []).map(d => (
              <span key={d} className="tag-pill tag-pill-amber">
                {d}
                <button className="tag-pill-remove" onClick={() => removeTag('dislikes', d)}>×</button>
              </span>
            ))}
            <input
              className="tag-inline-input"
              placeholder="Add dislike…"
              value={dislikeInput}
              onChange={e => setDislikeInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { addTag('dislikes', dislikeInput, setDislikeInput); e.preventDefault(); } }}
              onBlur={() => addTag('dislikes', dislikeInput, setDislikeInput)}
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label>Notes</label>
          <textarea
            rows={2}
            placeholder="e.g. vegetarian, prefers mild spice…"
            value={profile.notes || ''}
            onChange={e => onUpdate({ notes: e.target.value })}
            style={{ resize: 'vertical', marginTop: 4 }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Main SetupTab ──────────────────────────────────────────────────────────────
export default function SetupTab() {
  const { state, save } = useHouseholdState();
  const [newKid, setNewKid] = useState('');
  const [newAdult, setNewAdult] = useState('');

  // ── Kids list helpers ──────────────────────────────────────────────
  function addKid() {
    const n = newKid.trim();
    if (!n || state.kids.includes(n)) return;
    save({
      kids: [...state.kids, n],
      scores: { ...state.scores, [n]: 0 },
      weekScores: { ...state.weekScores, [n]: 0 },
      profiles: { ...state.profiles, [n]: { role: 'child', age: null, allergies: [], dislikes: [], notes: '' } },
    });
    setNewKid('');
  }

  function removeKid(i) {
    const name = state.kids[i];
    if (!confirm(`Remove ${name}?`)) return;
    const kids = state.kids.filter((_, idx) => idx !== i);
    const profiles = { ...state.profiles };
    delete profiles[name];
    save({ kids, profiles });
  }

  function renameKid(i, newName) {
    const oldName = state.kids[i];
    if (!newName || newName === oldName) return;
    const kids = state.kids.map((k, idx) => idx === i ? newName : k);
    const scores = { ...state.scores, [newName]: state.scores[oldName] || 0 };
    const weekScores = { ...state.weekScores, [newName]: state.weekScores[oldName] || 0 };
    delete scores[oldName];
    delete weekScores[oldName];
    const profiles = { ...state.profiles, [newName]: state.profiles[oldName] || { role: 'child', age: null, allergies: [], dislikes: [], notes: '' } };
    delete profiles[oldName];
    save({ kids, scores, weekScores, profiles });
  }

  // ── Profile helpers ────────────────────────────────────────────────
  function updateProfile(name, patch) {
    if (patch._rename) {
      const newName = patch._rename;
      const isKid = state.kids.includes(name);
      const profiles = { ...state.profiles, [newName]: state.profiles[name] };
      delete profiles[name];
      if (isKid) {
        renameKid(state.kids.indexOf(name), newName);
      } else {
        save({ profiles });
      }
      return;
    }
    save({
      profiles: { ...state.profiles, [name]: { ...state.profiles[name], ...patch } },
    });
  }

  function addAdult() {
    const n = newAdult.trim();
    if (!n || state.profiles[n]) return;
    save({
      profiles: { ...state.profiles, [n]: { role: 'adult', age: null, allergies: [], dislikes: [], notes: '' } },
    });
    setNewAdult('');
  }

  function removeAdult(name) {
    if (!confirm(`Remove ${name}?`)) return;
    const profiles = { ...state.profiles };
    delete profiles[name];
    save({ profiles });
  }

  // ── Other prefs + rewards ──────────────────────────────────────────
  function parseRewards(text) {
    const rewards = text.split('\n')
      .filter(l => l.trim())
      .map(l => { const [p, ...rest] = l.split('|'); return { pts: parseInt(p) || 0, label: rest.join('|').trim() }; })
      .filter(r => r.pts && r.label);
    save({ rewards });
  }

  function updatePref(key, value) {
    save({ prefs: { ...state.prefs, [key]: value } });
  }

  // ── Derived lists ──────────────────────────────────────────────────
  const adultNames = Object.keys(state.profiles || {}).filter(n => state.profiles[n]?.role === 'adult');

  return (
    <div className="panel">
      {/* ── Kids (cooperation points) ── */}
      <div className="card mb12">
        <div className="card-head"><span className="card-title">Children (cooperation points)</span></div>
        <div className="card-body">
          <div className="kids-list">
            {state.kids.map((k, i) => (
              <div key={i} className="kid-row">
                <input
                  type="text"
                  defaultValue={k}
                  onBlur={e => renameKid(i, e.target.value.trim())}
                  style={{ maxWidth: 200 }}
                />
                <button className="btn btn-sm btn-danger" onClick={() => removeKid(i)}>Remove</button>
              </div>
            ))}
          </div>
          <div className="flex gap8 mt8">
            <input
              type="text"
              placeholder="Add child name…"
              value={newKid}
              onChange={e => setNewKid(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addKid()}
              style={{ maxWidth: 220 }}
            />
            <button className="btn btn-sm btn-primary" onClick={addKid}>Add</button>
          </div>
        </div>
      </div>

      {/* ── Family profiles ── */}
      <div className="card mb12">
        <div className="card-head"><span className="card-title">Family profiles</span></div>
        <div className="card-body">
          <div className="profiles-grid">
            {state.kids.map(name => (
              <ProfileCard
                key={name}
                name={name}
                profile={state.profiles?.[name] || { role: 'child', age: null, allergies: [], dislikes: [], notes: '' }}
                onUpdate={patch => updateProfile(name, patch)}
                onRemove={() => {}}
                isKid={true}
              />
            ))}
            {adultNames.map(name => (
              <ProfileCard
                key={name}
                name={name}
                profile={state.profiles[name]}
                onUpdate={patch => updateProfile(name, patch)}
                onRemove={() => removeAdult(name)}
                isKid={false}
              />
            ))}
          </div>
          <div className="flex gap8 mt12">
            <input
              type="text"
              placeholder="Add adult (name)…"
              value={newAdult}
              onChange={e => setNewAdult(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addAdult()}
              style={{ maxWidth: 220 }}
            />
            <button className="btn btn-sm btn-primary" onClick={addAdult}>Add adult</button>
          </div>
        </div>
      </div>

      {/* ── Meal preferences ── */}
      <div className="card mb12">
        <div className="card-head"><span className="card-title">Meal preferences</span></div>
        <div className="card-body">
          <div className="setup-grid">
            <div>
              <label>Favourite cuisines</label>
              <input type="text" placeholder="e.g. Italian, Asian, Mexican…" value={state.prefs.cuisines || ''} onChange={e => updatePref('cuisines', e.target.value)} />
            </div>
            <div>
              <label>Weeknight time budget</label>
              <select value={state.prefs.time || '30–45 min'} onChange={e => updatePref('time', e.target.value)}>
                <option>Under 20 min</option>
                <option>20–30 min</option>
                <option>30–45 min</option>
                <option>Up to 60 min</option>
              </select>
            </div>
            <div>
              <label>Weekend cooking</label>
              <select value={state.prefs.weekend || 'Happy to cook more'} onChange={e => updatePref('weekend', e.target.value)}>
                <option>Quick meals only</option>
                <option>Happy to cook more</option>
                <option>Elaborate / roasts</option>
              </select>
            </div>
          </div>
          <hr className="divider" />
          <label>Meal planning style</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {PLANNING_STYLES.map(s => (
              <label key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontWeight: 'normal', color: 'var(--ink)', marginBottom: 0 }}>
                <input
                  type="radio"
                  name="planningStyle"
                  value={s.id}
                  checked={(state.prefs.planningStyle || 'family-veggie') === s.id}
                  onChange={() => updatePref('planningStyle', s.id)}
                  style={{ marginTop: 3, width: 'auto' }}
                />
                <span>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{s.label}</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--mid)', marginTop: 1 }}>{s.description}</span>
                </span>
              </label>
            ))}
          </div>
          {(state.prefs.planningStyle || 'family-veggie') === 'custom' && (
            <textarea
              rows="4"
              placeholder="Describe your meal planning rules — format requirements, protein preferences, number of options per day…"
              value={state.prefs.planningCustom || ''}
              onChange={e => updatePref('planningCustom', e.target.value)}
              style={{ resize: 'vertical', marginBottom: 12 }}
            />
          )}
          <hr className="divider" />
          <label>Recipe inspiration</label>
          <textarea
            rows="2"
            placeholder="e.g. NYT Cooking — Melissa Clark, Sam Sifton; Ottolenghi; Nigella Lawson…"
            value={state.prefs.recipeInspiration || ''}
            onChange={e => updatePref('recipeInspiration', e.target.value)}
            style={{ resize: 'vertical', marginBottom: 4 }}
          />
          <span style={{ fontSize: 11, color: 'var(--mid)' }}>
            Claude draws on these sources when generating meal ideas. It can't browse live sites, but uses what it knows from training data.
          </span>
          <hr className="divider" />
          <label>Foods to avoid / rotate out</label>
          <textarea
            rows="2"
            placeholder="e.g. we had pasta twice last week, avoid red meat on school nights…"
            value={state.prefs.avoid || ''}
            onChange={e => updatePref('avoid', e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </div>
      </div>

      {/* ── Cooperation point rules ── */}
      <div className="card mb12">
        <div className="card-head"><span className="card-title">Cooperation point rules</span></div>
        <div className="card-body">
          <label className="mb8">Custom behaviours & points</label>
          <textarea
            rows="3"
            placeholder="e.g. 'Get dressed without reminders +2', 'Read for 20 min +1'…"
            value={state.prefs.ptsRules || ''}
            onChange={e => updatePref('ptsRules', e.target.value)}
            style={{ resize: 'vertical' }}
          />
          <hr className="divider" />
          <label className="mb8">Reward menu (one per line: pts | reward)</label>
          <textarea
            rows="5"
            placeholder={'5 | 30 min extra TV\n10 | 1 hr computer games\n20 | Choose Friday dinner'}
            defaultValue={state.rewards.map(r => `${r.pts} | ${r.label}`).join('\n')}
            onBlur={e => parseRewards(e.target.value)}
            style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
          />
        </div>
      </div>

      <div className="flex gap8 flex-end">
        <button
          className="btn btn-sm btn-danger"
          onClick={() => { if (confirm('Reset all data?')) { localStorage.clear(); location.reload(); } }}
        >
          Reset all data
        </button>
        <button className="btn btn-sm btn-primary" onClick={() => alert('Settings saved!')}>
          Save settings
        </button>
      </div>
    </div>
  );
}
