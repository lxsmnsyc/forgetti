import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { bump } from '../../shared/counter.js';
import FilterItemDropdown from './dropdown.jsx';
import { FilterItem } from './item.jsx';
import { NavigationContext } from './navigation.jsx';

// components/layout/search/filter/index.tsx
function FilterItemList({ list }) {
  return (
    <>
      {list.map((item, i) => (
        <FilterItem key={i} item={item} />
      ))}
    </>
  );
}

export default function FilterList({ list, title }) {
  return (
    <>
      <nav>
        {title ? (
          <h3 className="hidden text-xs text-neutral-500 md:block dark:text-neutral-400">{title}</h3>
        ) : null}
        <ul className="hidden md:block">
          <Suspense fallback={null}>
            <FilterItemList list={list} />
          </Suspense>
        </ul>
        <ul className="md:hidden">
          <Suspense fallback={null}>
            <FilterItemDropdown list={list} />
          </Suspense>
        </ul>
      </nav>
    </>
  );
}

// The counted call feeds the result, so a compiler that skips the work also skips the count.
function describeQuery(pathname, search, sorting) {
  bump('describe');
  const params = new URLSearchParams(search);
  const sort = params.get('sort');
  let sortTitle = 'Relevance';
  for (const item of sorting) {
    if (item.slug === sort) {
      sortTitle = item.title;
    }
  }
  const q = params.get('q');
  return `${q ? `"${q}" in ` : ''}${pathname}, sorted by ${sortTitle}`;
}

// Harness entry, after app/search/layout.tsx: collections on the left, sorting on the right.
// The path and query live in state and stand in for the router.
export function SearchLayout({ collections, sorting, initialPath, initialSearch }) {
  const [pathname, setPathname] = useState(initialPath);
  const [search, setSearch] = useState(initialSearch);
  const rootRef = useRef(null);

  useEffect(() => {
    globalThis.__search = { root: rootRef.current, setPathname, setSearch };
  });

  const navigation = useMemo(
    () => ({
      pathname,
      searchParams: new URLSearchParams(search),
      router: {
        push: (href) => {
          const [path, query = ''] = href.split('?');
          setPathname(path);
          setSearch(query);
        },
      },
    }),
    [pathname, search],
  );
  const summary = useMemo(
    () => describeQuery(pathname, search, sorting),
    [pathname, search, sorting],
  );

  return (
    <NavigationContext.Provider value={navigation}>
      <div ref={rootRef} className="mx-auto flex max-w-(--breakpoint-2xl) flex-col gap-8">
        <div className="order-first w-full flex-none md:max-w-[125px]">
          <FilterList list={collections} title="Collections" />
        </div>
        <p className="order-last min-h-screen w-full md:order-none">{summary}</p>
        <div className="order-none flex-none md:order-last md:w-[125px]">
          <FilterList list={sorting} title="Sort by" />
        </div>
      </div>
    </NavigationContext.Provider>
  );
}
