import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
// Refresh only while awaiting the start, and stop when the screen loses focus.
export function usePendingGroupRefresh(pending: boolean, refresh: () => void) {
  useFocusEffect(useCallback(() => {
    if (!pending) return;
    const timer = setInterval(refresh, 15000);
    return () => clearInterval(timer);
  }, [pending, refresh]));
}
