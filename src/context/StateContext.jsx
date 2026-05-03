import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { DEFAULT_STATE } from '../utils/defaults';
import { supabase, HOUSEHOLD_ROW_ID } from '../lib/supabase';

const StateContext = createContext(null);

function loadLocalState() {
  try {
    return JSON.parse(localStorage.getItem('hh_state')) || DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

export function StateProvider({ children }) {
  const [state, setState] = useState(loadLocalState);

  useEffect(() => {
    // Fetch latest state from Supabase on mount
    supabase
      .from('household')
      .select('data')
      .eq('id', HOUSEHOLD_ROW_ID)
      .single()
      .then(({ data, error }) => {
        if (data?.data) {
          setState(data.data);
          localStorage.setItem('hh_state', JSON.stringify(data.data));
        } else if (!error || error.code === 'PGRST116') {
          // Row doesn't exist yet — seed it with current state
          const initial = loadLocalState();
          supabase.from('household').insert({ id: HOUSEHOLD_ROW_ID, data: initial });
        }
      });

    // Realtime: update state when another device saves
    const channel = supabase
      .channel('household-sync')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'household', filter: `id=eq.${HOUSEHOLD_ROW_ID}` },
        payload => {
          setState(payload.new.data);
          localStorage.setItem('hh_state', JSON.stringify(payload.new.data));
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const save = useCallback((patch) => {
    setState(prev => {
      const next = { ...prev, ...patch };
      localStorage.setItem('hh_state', JSON.stringify(next));
      supabase
        .from('household')
        .upsert({ id: HOUSEHOLD_ROW_ID, data: next, updated_at: new Date().toISOString() })
        .then(({ error }) => { if (error) console.error('Supabase sync error:', error); });
      return next;
    });
  }, []);

  return (
    <StateContext.Provider value={{ state, save }}>
      {children}
    </StateContext.Provider>
  );
}

export function useHouseholdState() {
  return useContext(StateContext);
}
