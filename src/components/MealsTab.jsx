import { useState } from 'react';
import { useHouseholdState } from '../context/StateContext';

export default function MealsTab({ onQuickSend }) {
  const { state, save } = useHouseholdState();
  const [editingIdx, setEditingIdx] = useState(null);
  const [editName, setEditName] = useState('');
  const [editTime, setEditTime] = useState('');

  function toggleEdit(i) {
    if (editingIdx === i) {
      setEditingIdx(null);
    } else {
      setEditingIdx(i);
      setEditName(state.meals[i].name || '');
      setEditTime(state.meals[i].time || '');
      save({ lastMealDay: state.meals[i].day });
    }
  }

  function saveMeal(i) {
    const meals = state.meals.map((m, idx) =>
      idx === i ? { ...m, name: editName, time: editTime } : m
    );
    save({ meals });
    setEditingIdx(null);
  }

  function clearMeals() {
    if (confirm('Clear all meals?')) {
      save({ meals: state.meals.map(m => ({ ...m, name: '', time: '' })) });
    }
  }

  const total = state.meals.filter(m => m.name).length;
  const quick = state.meals.filter(m => m.time && parseInt(m.time) < 35).length;

  return (
    <div className="panel">
      <div className="stat-row">
        <div className="stat"><div className="stat-val">{total}</div><div className="stat-label">Meals planned</div></div>
        <div className="stat"><div className="stat-val">{7 - total}</div><div className="stat-label">Still to plan</div></div>
        <div className="stat"><div className="stat-val">{quick}</div><div className="stat-label">Quick meals (&lt;35 min)</div></div>
      </div>
      <div className="card">
        <div className="card-head">
          <span className="card-title">This week's meals</span>
          <button className="btn btn-sm ml-auto" onClick={clearMeals}>Clear all</button>
        </div>
        <div className="card-body">
          <div className="meal-grid">
            {state.meals.map((m, i) => (
              <div
                key={m.day}
                className={`meal-day${editingIdx === i ? ' editing' : ''}`}
                onClick={() => editingIdx !== i && toggleEdit(i)}
              >
                <div className="meal-day-label">{m.day}</div>
                {editingIdx === i ? (
                  <div className="meal-day-edit" onClick={e => e.stopPropagation()}>
                    <input
                      value={editName}
                      placeholder="Meal name"
                      onChange={e => setEditName(e.target.value)}
                    />
                    <input
                      value={editTime}
                      placeholder="Time (e.g. 30 min)"
                      onChange={e => setEditTime(e.target.value)}
                    />
                    <button className="save-btn" onClick={() => saveMeal(i)}>Save</button>
                  </div>
                ) : (
                  <>
                    <div className="meal-day-name">
                      {m.name || <span style={{ color: 'var(--mid)', fontStyle: 'italic' }}>Tap to set</span>}
                    </div>
                    <div className="meal-day-meta">{m.time}</div>
                  </>
                )}
              </div>
            ))}
          </div>
          <hr className="divider" />
          <div className="flex gap8 flex-end">
            <button className="btn btn-sm" onClick={() => onQuickSend(`Suggest an alternative for ${state.lastMealDay}`)}>
              Suggest swap
            </button>
            <button className="btn btn-sm btn-primary" onClick={() => onQuickSend('Generate a shopping list from the current meal plan')}>
              → Shopping list
            </button>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-head"><span className="card-title">Meal notes</span></div>
        <div className="card-body">
          <textarea
            rows="3"
            placeholder="Prep notes, slow cooker tips, who's cooking…"
            value={state.mealNotes || ''}
            onChange={e => save({ mealNotes: e.target.value })}
            style={{ resize: 'vertical' }}
          />
        </div>
      </div>
    </div>
  );
}
