import { useCallback, useEffect, useState } from "react";
import {
  addItem,
  catchUp,
  completeItem,
  initialState,
  pause,
  removeItem,
  restoreItem,
  setAllowance,
  startOrResume,
  type PaceState,
} from "./lib/pace";
import { loadState, saveState } from "./lib/storage";

export function usePace() {
  const [state, setState] = useState<PaceState>(() => loadState());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setState((current) => catchUp(current, now));
  }, [now]);

  const updateAllowance = useCallback((allowance: number) => {
    setState((current) => setAllowance(current, allowance));
  }, []);

  const togglePace = useCallback(() => {
    const at = Date.now();
    setNow(at);
    setState((current) =>
      current.pacing ? pause(current, at) : startOrResume(current, at),
    );
  }, []);

  const createItem = useCallback((title: string, cost: number) => {
    const at = Date.now();
    setState((current) => addItem(current, title, cost, at));
  }, []);

  const deleteItem = useCallback((id: string) => {
    setState((current) => removeItem(current, id));
  }, []);

  const finishItem = useCallback((id: string) => {
    const at = Date.now();
    setState((current) => completeItem(current, id, at));
  }, []);

  const reopenItem = useCallback((id: string) => {
    setState((current) => restoreItem(current, id));
  }, []);

  const clear = useCallback(() => {
    setState(initialState());
  }, []);

  return {
    state,
    now,
    updateAllowance,
    togglePace,
    createItem,
    deleteItem,
    finishItem,
    reopenItem,
    clear,
  };
}
