import { createContext, useContext } from 'react';

// Stands in for next/navigation and next/link: the page keeps the path and query in state
// and provides them. A link click navigates through the same router.
export const NavigationContext = createContext(null);

export function usePathname() {
  return useContext(NavigationContext).pathname;
}

export function useSearchParams() {
  return useContext(NavigationContext).searchParams;
}

export default function Link({ href, prefetch, children, ...props }) {
  const { router } = useContext(NavigationContext);
  return (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        event.preventDefault();
        router.push(href);
      }}
    >
      {children}
    </a>
  );
}
