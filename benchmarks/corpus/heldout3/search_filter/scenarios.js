import { phases } from '../../shared/scenarios.js';

const collections = [
  { title: 'All', path: '/search' },
  { title: 'Shirts', path: '/search/shirts' },
  { title: 'Stickers', path: '/search/stickers' },
];
const sorting = [
  { title: 'Relevance', slug: null, sortKey: 'RELEVANCE', reverse: false },
  { title: 'Trending', slug: 'trending-desc', sortKey: 'BEST_SELLING', reverse: false },
  { title: 'Latest arrivals', slug: 'latest-desc', sortKey: 'CREATED_AT', reverse: true },
  { title: 'Price: Low to high', slug: 'price-asc', sortKey: 'PRICE', reverse: false },
];
const base = { collections, sorting, initialPath: '/search', initialSearch: 'q=shirt' };
const layout = () => globalThis.__search;

// Clicks the last link with this text, so an open dropdown's link wins over the list's.
function clickLink(text) {
  let found = null;
  for (const link of layout().root.querySelectorAll('a')) {
    if (link.textContent === text) {
      found = link;
    }
  }
  if (found === null) {
    throw new Error(`No link ${text}`);
  }
  found.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

function toggleDropdown(index) {
  const toggles = layout().root.querySelectorAll('.relative > div:first-child');
  toggles[index].dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

export default [
  ...phases('SearchLayout', base, {
    same_lists: { ...base, collections: [...collections], sorting: [...sorting] },
    fewer_sorts: { ...base, sorting: sorting.slice(0, 2) },
  }),
  {
    name: 'navigate',
    component: 'SearchLayout',
    props: base,
    steps: [
      { name: 'collection', act: () => clickLink('Shirts') },
      { name: 'sort', act: () => clickLink('Trending') },
      { name: 'same_search', act: () => layout().setSearch('sort=trending-desc') },
      { name: 'query', act: () => layout().setSearch('q=mug&sort=price-asc') },
    ],
  },
  {
    name: 'dropdown',
    component: 'SearchLayout',
    props: base,
    steps: [
      { name: 'open', act: () => toggleDropdown(1) },
      { name: 'pick', act: () => clickLink('Latest arrivals') },
      { name: 'open_again', act: () => toggleDropdown(1) },
      { name: 'close', act: () => toggleDropdown(1) },
    ],
  },
];
