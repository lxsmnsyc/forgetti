import { phases } from '../../../../../corpus/shared/scenarios.js';

const discussions = [
  { id: 'd1', title: 'First post', createdAt: '2024-01-02T10:00:00Z' },
  { id: 'd2', title: 'Second post', createdAt: '2024-02-03T10:00:00Z' },
  { id: 'd3', title: 'Third post', createdAt: '2024-03-04T10:00:00Z' },
];
const meta = { page: 2, totalPages: 5 };
const base = { discussions, meta, onDiscussionPrefetch: undefined };
const onPrefetch = () => {};

export default [
  ...phases('DiscussionsList', base, {
    same_discussions: { ...base, discussions: [...discussions] },
    first_page: { ...base, meta: { page: 1, totalPages: 5 } },
    last_page: { ...base, meta: { page: 5, totalPages: 5 } },
    no_meta: { ...base, meta: undefined },
    fewer: { ...base, discussions: discussions.slice(0, 2) },
    empty: { ...base, discussions: [] },
    not_loaded: { ...base, discussions: undefined },
    prefetch: { ...base, onDiscussionPrefetch: onPrefetch },
  }),
  {
    name: 'paging',
    component: 'DiscussionsList',
    props: base,
    steps: [
      { name: 'page_3', props: { ...base, meta: { page: 3, totalPages: 5 } } },
      { name: 'page_3_again', props: { ...base, meta: { page: 3, totalPages: 5 } } },
      { name: 'page_4', props: { ...base, meta: { page: 4, totalPages: 5 } } },
      {
        name: 'edit_title',
        props: {
          ...base,
          discussions: [{ ...discussions[0], title: 'Renamed' }, ...discussions.slice(1)],
        },
      },
    ],
  },
];
