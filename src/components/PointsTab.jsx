import { useState } from 'react';
import { useHouseholdState } from '../context/StateContext';

const REASONS = [
  { label: 'Listened first time (+1)', pts: 1 },
  { label: 'Joined activity (+1)', pts: 1 },
  { label: 'No complaining (+1)', pts: 1 },
  { label: 'Helped without asking (+1)', pts: 1 },
  { label: 'Completed chores (+1)', pts: 1 },
  { label: 'Refused / complained (-1)', pts: -1 },
  { label: 'Did not listen (-1)', pts: -1 },
];

export default function PointsTab({ onRewardRedeem }) {
  const { state, save } = useHouseholdState();
  const [redeemReward, setRedeemReward] = useState(null); // reward being redeemed
  const [redeemKid, setRedeemKid] = useState('');
  const [selectedKid, setSelectedKid] = useState(state.kids[0] || '');
  const [selectedReasonIdx, setSelectedReasonIdx] = useState(0);
  const [customPts, setCustomPts] = useState(1);

  function adjustPts(kid, delta) {
    save({
      scores: { ...state.scores, [kid]: (state.scores[kid] || 0) + delta },
      weekScores: { ...state.weekScores, [kid]: (state.weekScores[kid] || 0) + delta },
    });
  }

  function logEntry() {
    const kid = selectedKid || state.kids[0];
    if (!kid) return;
    const reason = REASONS[selectedReasonIdx];
    const pts = reason ? reason.pts : customPts;
    const label = reason ? reason.label.replace(/[+-]\d+/, '').trim() : 'Custom';
    save({
      scores: { ...state.scores, [kid]: (state.scores[kid] || 0) + pts },
      weekScores: { ...state.weekScores, [kid]: (state.weekScores[kid] || 0) + pts },
      log: [...state.log, { kid, reason: label, pts, ts: Date.now() }],
    });
  }

  function resetWeek() {
    if (!confirm("Reset this week's scores? Total scores are kept.")) return;
    const weekScores = {};
    state.kids.forEach(k => { weekScores[k] = 0; });
    save({ weekScores });
  }

  const recentLog = [...state.log].reverse().slice(0, 20);

  return (
    <div className="panel">
      <div className="card mb12">
        <div className="card-head">
          <span className="card-title">Cooperation points</span>
          <button className="btn btn-sm ml-auto" onClick={resetWeek}>Reset week</button>
        </div>
        <div className="card-body">
          <div className="pts-grid">
            {state.kids.map(kid => (
              <div key={kid} className="pts-kid">
                <div className="pts-kid-name">{kid}</div>
                <div className="pts-score">{state.scores[kid] || 0}</div>
                <div style={{ fontSize: 11, color: 'var(--mid)', marginBottom: 8 }}>
                  This week: {(state.weekScores[kid] || 0) >= 0 ? '+' : ''}{state.weekScores[kid] || 0}
                </div>
                <div className="pts-btns">
                  <button className="pts-btn plus" onClick={() => adjustPts(kid, 1)}>+</button>
                  <button className="pts-btn minus" onClick={() => adjustPts(kid, -1)}>−</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card mb12">
        <div className="card-head"><span className="card-title">Log entry</span></div>
        <div className="card-body">
          <div className="flex gap8 mb8">
            <select value={selectedKid} onChange={e => setSelectedKid(e.target.value)} style={{ flex: 1.2 }}>
              {state.kids.map(k => <option key={k}>{k}</option>)}
            </select>
            <select
              value={selectedReasonIdx}
              onChange={e => setSelectedReasonIdx(Number(e.target.value))}
              style={{ flex: 2 }}
            >
              {REASONS.map((r, i) => <option key={i} value={i}>{r.label}</option>)}
            </select>
            <input
              type="number"
              value={customPts}
              min="-10" max="10"
              onChange={e => setCustomPts(parseInt(e.target.value) || 1)}
              style={{ width: 64, flex: 'none' }}
            />
            <button className="btn btn-primary btn-sm" onClick={logEntry}>Log</button>
          </div>
          <div className="pts-log">
            {recentLog.length === 0
              ? <span style={{ color: 'var(--mid)', fontSize: 12 }}>No entries yet</span>
              : recentLog.map((l, i) => (
                <div key={i} className="pts-log-item">
                  <span>{l.kid} — {l.reason}</span>
                  <span className={l.pts > 0 ? 'tag tag-green' : 'tag tag-red'}>
                    {l.pts > 0 ? '+' : ''}{l.pts}
                  </span>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><span className="card-title">Reward menu</span></div>
        <div className="card-body">
          <div className="rewards-grid">
            {state.rewards.map((r, i) => (
              <div key={i} className="reward-card" onClick={() => {
                setRedeemReward(r);
                setRedeemKid(state.kids[0] || '');
              }}>
                <div className="reward-pts">{r.pts}</div>
                <div className="reward-label">{r.label}</div>
              </div>
            ))}
          </div>

          {redeemReward && (
            <div className="redeem-confirm">
              <div className="redeem-confirm-text">
                Redeem <strong>{redeemReward.label}</strong> ({redeemReward.pts} pts) for:
              </div>
              <div className="redeem-confirm-row">
                <select
                  value={redeemKid}
                  onChange={e => setRedeemKid(e.target.value)}
                  style={{ flex: 1 }}
                >
                  {state.kids.map(k => (
                    <option key={k} value={k}>
                      {k} ({state.scores[k] || 0} pts)
                    </option>
                  ))}
                </select>
                <button className="btn btn-sm btn-danger" onClick={() => setRedeemReward(null)}>
                  Cancel
                </button>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    const cost = redeemReward.pts;
                    save({
                      scores: { ...state.scores, [redeemKid]: (state.scores[redeemKid] || 0) - cost },
                      weekScores: { ...state.weekScores, [redeemKid]: (state.weekScores[redeemKid] || 0) - cost },
                      log: [...state.log, { kid: redeemKid, reason: `Redeemed: ${redeemReward.label}`, pts: -cost, ts: Date.now() }],
                    });
                    setRedeemReward(null);
                  }}
                >
                  Confirm redeem
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
