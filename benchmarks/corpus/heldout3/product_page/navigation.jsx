import { createContext, useContext } from 'react';

// Stands in for next/navigation: the page keeps the query string in state and provides it.
export const NavigationContext = createContext(null);

export function useSearchParams() {
  return useContext(NavigationContext).searchParams;
}

export function useRouter() {
  return useContext(NavigationContext).router;
}
