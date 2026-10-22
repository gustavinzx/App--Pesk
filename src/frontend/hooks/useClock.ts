import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

export function useClock() {
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(useCallback(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []));
  return now;
}
