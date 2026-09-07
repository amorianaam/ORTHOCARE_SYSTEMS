import { useState, useEffect } from 'react';

export function usePersistentState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error("Error reading localStorage key", key, error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error("Error setting localStorage key", key, error);
    }
  }, [key, state]);

  return [state, setState];
}
