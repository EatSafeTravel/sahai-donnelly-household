import { useState } from 'react';
import { useHouseholdState } from '../context/StateContext';

export default function MealsTab({ onQuickSend }) {
  const { state, save } = useHouseholdState();
  const [editingIdx, setEditingIdx] = useState(null);
  const [editName, setEditName] = useState('');
  const [editTime, setEditTime] = useState('');
  const [libraryFilter, setLibraryFilter] = useState('');
  const [newLibName, setNewLibName] = useState('');
  const [newLibTime, setNewLibTime] = useState('');

  const mealOptions = state.mealOptions || {};
  const mealLibrary = state.mealLibrary || [];

  function toggleEdit(i) {
    if (state.meals[i].skip) return; // don't open edit on skipped days
    if (editingIdx === i) { setEditingIdx(null); return; }
    setEditingIdx(i);
    setEditName(state.meals[i].name || '');
    setEditTime(state.meals[i].time || '');
    save({ lastMealDay: state.meals[i].day });
  }

  function toggleSkip(i) {
    const meals = state.meals.map((m, idx) =>
      idx === i ? { ...m, skip: !m.skip, name: m.skip ? m.name : '', time: m.skip ? m.time : '' } : m
    );
    if (editingIdx === i) setEditingIdx(null);
    save({ meals });
  }

  function saveMeal(i) {
    const meals = state.meals.map((m, idx) =>
      idx === i ? { ...m, name: editName, time: editTime } : m
    );
    save({ meals });
    setEditingIdx(null);
  }

  function pickOption(opt) {
    setEditName(opt.name);
    setEditTime(opt.time || '');
  }

  function saveToLibrary(name, time) {
    if (!name || mealLibrary.find(m => m.name.toLowerCase() === name.toLowerCase())) return;
    save({ mealLibrary: [...mealLibrary, { name, time: time || '' }] });
  }

  function saveAllToLibrary() {
    const toAdd = state.meals
      .filter(m => m.name)
      .filter(m => !mealLibrary.find(l => l.name.toLowerCase() === m.name.toLowerCase()));
    if (toAdd.length === 0) { alert('All current meals are already in the library.'); return; }
    save({ mealLibrary: [...mealLibrary, ...toAdd] });
  }

  function removeFromLibrary(i) {
    save({ mealLibrary: mealLibrary.filter((_, idx) => idx !== i) });
  }

  function addToLibrary() {
    const n = newLibName.trim();
    if (!n) return;
    saveToLibrary(n, newLibTime.trim());
    setNewLibName(''); setNewLibTime('');
  }

  function clearMeals() {
    if (confirm('Clear all meals?')) {
      save({ meals: state.meals.map(m => ({ ...m, name: '', time: '' })), mealOptions: {} });
    }
  }

  const skipped = state.meals.filter(m => m.skip).length;
  const total = state.meals.filter(m => m.name && !m.skip).length;
  const quick = state.meals.filter(m => !m.skip && m.time && parseInt(m.time) < 35).length;
  const filteredLibrary = libraryFilter
    ? mealLibrary.filter(m => m.name.toLowerCase().includes(libraryFilter.toLowerCase()))
    : mealLibrary;

  return (
    <div className="panel">
      <div className="stat-row">
        <div className="stat"><div className="stat-val">{total}</div><div className="stat-label">Meals planned</div></div>
        <div className="stat"><div className="stat-val">{7 - total - skipped}</div><div className="stat-label">Still to plan</div></div>
        <div className="stat"><div className="stat-val">{quick}</div><div className="stat-label">Quick meals (&lt;35 min)</div></div>
        {skipped > 0 && <div className="stat"><div className="stat-val">{skipped}</div><div className="stat-label">Not home</div></div>}
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">This week's meals</span>
          <button className="btn btn-sm ml-auto" onClick={clearMeals}>Clear all</button>
        </div>
        <div className="card-body">
          <div className="meal-grid">
            {state.meals.map((m, i) => {
              const opts = mealOptions[m.day] || [];
              const isEditing = editingIdx === i;
              return (
                <div
                  key={m.day}
                  className={`meal-day${isEditing ? ' editing' : ''}${m.skip ? ' skipped' : ''}`}
                  onClick={() => !isEditing && !m.skip && toggleEdit(i)}
                >
                  <div className="meal-day-label">{m.day}</div>

                  {isEditing ? (
                    <div className="meal-day-edit" onClick={e => e.stopPropagation()}>
                      <input
                        value={editName}
                        placeholder="Meal name"
                        onChange={e => setEditName(e.target.value)}
                        autoFocus
                      />
                      <input
                        value={editTime}
                        placeholder="Time (e.g. 30 min)"
                        onChange={e => setEditTime(e.target.value)}
                      />

                      {/* AI-suggested options */}
                      {opts.length > 0 && (
                        <div className="meal-opts-section">
                          <div className="meal-opts-label">AI suggestions</div>
                          <div className="meal-opts-row">
                            {opts.map((opt, j) => (
                              <button
                                key={j}
                                className={`meal-opt-chip${editName === opt.name ? ' selected' : ''}`}
                                onClick={() => pickOption(opt)}
                              >
                                {opt.name}{opt.time ? ` · ${opt.time}` : ''}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Library picks */}
                      {mealLibrary.length > 0 && (
                        <div className="meal-opts-section">
                          <div className="meal-opts-label">Library</div>
                          <div className="meal-opts-row">
                            {mealLibrary.slice(0, 8).map((lib, j) => (
                              <button
                                key={j}
                                className={`meal-opt-chip library${editName === lib.name ? ' selected' : ''}`}
                                onClick={() => pickOption(lib)}
                              >
                                {lib.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                        <button className="save-btn" onClick={() => saveMeal(i)}>Save</button>
                        <button
                          className="save-btn"
                          style={{ background: 'var(--mid)' }}
                          onClick={() => saveToLibrary(editName, editTime)}
                          title="Save to library"
                        >
                          + Lib
                        </button>
                        <button
                          className="save-btn"
                          style={{ background: 'var(--mid)', marginLeft: 'auto' }}
                          onClick={() => setEditingIdx(null)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : m.skip ? (
                    <>
                      <div className="meal-day-name" style={{ color: 'var(--mid)', fontStyle: 'italic' }}>Not home</div>
                      <button className="meal-skip-btn" onClick={e => { e.stopPropagation(); toggleSkip(i); }}>
                        Mark as home
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="meal-day-name">
                        {m.name || <span style={{ color: 'var(--mid)', fontStyle: 'italic' }}>Tap to set</span>}
                      </div>
                      <div className="meal-day-meta">{m.time}</div>
                      {opts.length > 1 && (
                        <div className="meal-alts-badge">{opts.length - 1} alt{opts.length > 2 ? 's' : ''}</div>
                      )}
                      <button className="meal-skip-btn" onClick={e => { e.stopPropagation(); toggleSkip(i); }}>
                        Not home
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <hr className="divider" />
          <div className="flex gap8 flex-end">
            <button className="btn btn-sm btn-primary" onClick={() => onQuickSend('Generate a shopping list from the current meal plan')}>
              → Shopping list
            </button>
          </div>
        </div>
      </div>

      {/* Meal library */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">Meal library</span>
          <span className="text-mid" style={{ marginLeft: 8 }}>{mealLibrary.length} saved</span>
          <button className="btn btn-sm ml-auto" onClick={saveAllToLibrary}>Save this week →</button>
        </div>
        <div className="card-body">
          {mealLibrary.length > 4 && (
            <input
              type="text"
              placeholder="Search library…"
              value={libraryFilter}
              onChange={e => setLibraryFilter(e.target.value)}
              style={{ marginBottom: 10 }}
            />
          )}
          <div className="meal-library-grid">
            {filteredLibrary.map((meal, i) => (
              <span key={i} className="library-meal-chip">
                <span>{meal.name}</span>
                {meal.time && <span className="library-meal-time">{meal.time}</span>}
                <button onClick={() => removeFromLibrary(mealLibrary.indexOf(meal))} title="Remove">×</button>
              </span>
            ))}
            {filteredLibrary.length === 0 && (
              <span style={{ color: 'var(--mid)', fontSize: 12 }}>
                {mealLibrary.length === 0 ? 'No meals saved yet — run weekly setup or add one below.' : 'No matches.'}
              </span>
            )}
          </div>
          <hr className="divider" />
          <div className="flex gap8">
            <input type="text" placeholder="Add meal to library…" value={newLibName}
              onChange={e => setNewLibName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addToLibrary()}
              style={{ flex: 2 }} />
            <input type="text" placeholder="Time" value={newLibTime}
              onChange={e => setNewLibTime(e.target.value)}
              style={{ flex: 1 }} />
            <button className="btn btn-sm btn-primary" onClick={addToLibrary}>Add</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><span className="card-title">Meal notes</span></div>
        <div className="card-body">
          <textarea rows="3" placeholder="Prep notes, slow cooker tips, who's cooking…"
            value={state.mealNotes || ''}
            onChange={e => save({ mealNotes: e.target.value })}
            style={{ resize: 'vertical' }} />
        </div>
      </div>
    </div>
  );
}
