import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { StateProvider } from './context/StateContext';
import LoginScreen from './components/LoginScreen';
import AgentTab from './components/AgentTab';
import MealsTab from './components/MealsTab';
import ShoppingTab from './components/ShoppingTab';
import PointsTab from './components/PointsTab';
import SetupTab from './components/SetupTab';

const TABS = [
  { id: 'agent', label: 'Agent' },
  { id: 'meals', label: 'Meals' },
  { id: 'shop', label: 'Shopping' },
  { id: 'points', label: 'Points' },
  { id: 'setup', label: 'Setup' },
];

function AppInner() {
  const [activeTab, setActiveTab] = useState('agent');
  const [pendingMsg, setPendingMsg] = useState(null);

  function quickSend(text) {
    setActiveTab('agent');
    setPendingMsg(text || null);
  }

  function handleRewardRedeem(reward) {
    quickSend(`Redeem ${reward.pts} cooperation points for: ${reward.label}`);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <>
      <nav className="nav">
        <span className="nav-brand">Household</span>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`nav-tab${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <button className="nav-tab" onClick={handleSignOut} title="Sign out" style={{ marginLeft: 4 }}>
          ⎋
        </button>
      </nav>

      {activeTab === 'agent' && (
        <AgentTab
          pendingMsg={pendingMsg}
          onPendingMsgConsumed={() => setPendingMsg(null)}
          onQuickSend={quickSend}
        />
      )}
      {activeTab === 'meals' && <MealsTab onQuickSend={quickSend} />}
      {activeTab === 'shop' && <ShoppingTab />}
      {activeTab === 'points' && <PointsTab onRewardRedeem={handleRewardRedeem} />}
      {activeTab === 'setup' && <SetupTab />}
    </>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div className="login-wrap"><div className="login-sub">Loading…</div></div>;
  if (!session) return <LoginScreen />;

  return (
    <StateProvider>
      <AppInner />
    </StateProvider>
  );
}
