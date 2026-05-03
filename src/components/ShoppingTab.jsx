import { useState } from 'react';
import { useHouseholdState } from '../context/StateContext';

const CATEGORIES = ['Produce', 'Meat & fish', 'Pantry', 'Dairy', 'Frozen', 'Other'];

export default function ShoppingTab() {
  const { state, save } = useHouseholdState();
  const [addName, setAddName] = useState('');
  const [addQty, setAddQty] = useState('');
  const [addCat, setAddCat] = useState('Produce');
  const [inlineInputs, setInlineInputs] = useState({});

  function toggleItem(cat, i) {
    const shop = { ...state.shop, [cat]: state.shop[cat].map((item, idx) =>
      idx === i ? { ...item, done: !item.done } : item
    )};
    save({ shop });
  }

  function clearDone() {
    const shop = {};
    Object.keys(state.shop).forEach(c => { shop[c] = state.shop[c].filter(i => !i.done); });
    save({ shop });
  }

  function addItem() {
    const n = addName.trim();
    if (!n) return;
    const shop = { ...state.shop, [addCat]: [...(state.shop[addCat] || []), { name: n, qty: addQty.trim() || '1', done: false }] };
    save({ shop });
    setAddName(''); setAddQty('');
  }

  function quickAdd(cat) {
    const n = (inlineInputs[`name-${cat}`] || '').trim();
    const q = (inlineInputs[`qty-${cat}`] || '').trim() || '1';
    if (!n) return;
    const shop = { ...state.shop, [cat]: [...(state.shop[cat] || []), { name: n, qty: q, done: false }] };
    save({ shop });
    setInlineInputs(prev => ({ ...prev, [`name-${cat}`]: '', [`qty-${cat}`]: '' }));
  }

  const allItems = Object.values(state.shop).flat();
  const total = allItems.length;
  const done = allItems.filter(i => i.done).length;

  return (
    <div className="panel">
      <div className="stat-row">
        <div className="stat"><div className="stat-val">{total}</div><div className="stat-label">Total items</div></div>
        <div className="stat"><div className="stat-val">{done}</div><div className="stat-label">Checked off</div></div>
        <div className="stat"><div className="stat-val">{total - done}</div><div className="stat-label">Still needed</div></div>
      </div>
      <div className="card mb12">
        <div className="card-head">
          <span className="card-title">Shopping list</span>
          <button className="btn btn-sm ml-auto btn-danger" onClick={clearDone}>Remove checked</button>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="shop-grid" style={{ padding: '12px' }}>
            {CATEGORIES.map(cat => (
              <div key={cat} className="card" style={{ margin: 0, borderRadius: 8, overflow: 'hidden' }}>
                <div className="shop-cat-head">{cat}</div>
                {(state.shop[cat] || []).map((item, i) => (
                  <div
                    key={i}
                    className={`shop-item-row${item.done ? ' done' : ''}`}
                    onClick={() => toggleItem(cat, i)}
                  >
                    <div className="shop-cb">{item.done ? '✓' : ''}</div>
                    <span className="shop-item-name">{item.name}</span>
                    <span className="shop-item-qty">{item.qty}</span>
                  </div>
                ))}
                <div className="shop-add-row">
                  <input
                    placeholder="Add item…"
                    value={inlineInputs[`name-${cat}`] || ''}
                    onChange={e => setInlineInputs(prev => ({ ...prev, [`name-${cat}`]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && quickAdd(cat)}
                    style={{ flex: 2 }}
                  />
                  <input
                    placeholder="qty"
                    value={inlineInputs[`qty-${cat}`] || ''}
                    onChange={e => setInlineInputs(prev => ({ ...prev, [`qty-${cat}`]: e.target.value }))}
                    style={{ width: 60, flex: 'none' }}
                  />
                  <button className="btn btn-sm" onClick={() => quickAdd(cat)}>+</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-head"><span className="card-title">Add item manually</span></div>
        <div className="card-body">
          <div className="flex gap8">
            <input type="text" placeholder="Item name" value={addName} onChange={e => setAddName(e.target.value)} style={{ flex: 2 }} />
            <input type="text" placeholder="Qty" value={addQty} onChange={e => setAddQty(e.target.value)} style={{ flex: 1 }} />
            <select value={addCat} onChange={e => setAddCat(e.target.value)} style={{ flex: 1.5 }}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <button className="btn btn-primary btn-sm" onClick={addItem}>Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}
