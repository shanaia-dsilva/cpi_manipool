import { expireLiveRouting } from '../services/liveRouting';
import React, { createContext, useContext, useEffect, useReducer } from 'react';
import { Action, appReducer, initialState } from './reducer';
import { AppState } from '../types/domain';
const Context = createContext<
  { state: AppState; dispatch: React.Dispatch<Action> } | undefined
>(undefined);
export function AppProvider({ children }: React.PropsWithChildren) {
  const [state, dispatch] = useReducer(appReducer, undefined, initialState);
  useEffect(() => {
    const timer = setInterval(expireLiveRouting, 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Context.Provider value={{ state, dispatch }}>{children}</Context.Provider>
  );
}
export function useApp() {
  const context = useContext(Context);
  if (!context) {
    throw new Error('AppProvider is required.');
  }
  return context;
}
let sequence = 0;
export const newId = (prefix: string) =>
  `${prefix}-${Date.now()}-${++sequence}`;
export const nowISO = () => new Date().toISOString();
