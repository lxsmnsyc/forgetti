import { phases } from '../../shared/scenarios.js';

// The store is module state and the clock is real, yet runs stay deterministic. Every scenario
// uses toaster id 't', and SeededToaster clears and reseeds that id on mount. `createdAt` is taken
// at load and each duration is 600000 ms, so no duration timer fires during a run. The effect
// cleanup clears the timers on unmount. The `loading` toast has no duration and never expires.
const createdAt = Date.now();
const toasts = [
  {
    id: 'a',
    type: 'success',
    message: 'Saved',
    visible: true,
    pauseDuration: 0,
    createdAt,
    duration: 600000,
  },
  {
    id: 'b',
    type: 'error',
    message: 'Failed',
    visible: true,
    pauseDuration: 0,
    createdAt,
    duration: 600000,
  },
  { id: 'c', type: 'loading', message: 'Working', visible: true, pauseDuration: 0, createdAt },
];
const base = { toasterId: 't', seed: toasts, position: 'top-center', gutter: 8 };

// The toaster keeps its state in the module, so the steps change it through the exported dispatch.
function send(mod, action) {
  mod.dispatch(action, 't');
}

export default [
  ...phases('SeededToaster', base, {
    same_seed: { ...base, seed: [...toasts] },
    bottom: { ...base, position: 'bottom-right' },
    gutter: { ...base, gutter: 16 },
    reverse: { ...base, reverseOrder: true },
    options: { ...base, toastOptions: { success: { style: { color: 'green' } } } },
    class_name: { ...base, containerClassName: 'toasts' },
  }),
  {
    name: 'store',
    component: 'SeededToaster',
    props: base,
    steps: [
      {
        name: 'add',
        act: ({ mod }) =>
          send(mod, {
            type: mod.ActionType.ADD_TOAST,
            toast: {
              id: 'd',
              type: 'blank',
              message: 'New',
              visible: true,
              pauseDuration: 0,
              createdAt,
              duration: 600000,
            },
          }),
      },
      {
        name: 'update',
        act: ({ mod }) =>
          send(mod, {
            type: mod.ActionType.UPDATE_TOAST,
            toast: { id: 'a', message: 'Saved again' },
          }),
      },
      {
        name: 'heights',
        act: ({ mod }) => {
          send(mod, { type: mod.ActionType.UPDATE_TOAST, toast: { id: 'a', height: 40 } });
          send(mod, { type: mod.ActionType.UPDATE_TOAST, toast: { id: 'b', height: 50 } });
        },
      },
      {
        name: 'remove',
        act: ({ mod }) => send(mod, { type: mod.ActionType.REMOVE_TOAST, toastId: 'b' }),
      },
      {
        name: 'dismiss',
        act: ({ mod }) => send(mod, { type: mod.ActionType.DISMISS_TOAST, toastId: 'a' }),
      },
      { name: 'clear', act: ({ mod }) => send(mod, { type: mod.ActionType.REMOVE_TOAST }) },
    ],
  },
  {
    name: 'pause',
    component: 'SeededToaster',
    props: base,
    steps: [
      {
        name: 'pause',
        act: ({ mod }) => send(mod, { type: mod.ActionType.START_PAUSE, time: createdAt }),
      },
      {
        name: 'resume',
        act: ({ mod }) => send(mod, { type: mod.ActionType.END_PAUSE, time: createdAt + 500 }),
      },
      { name: 'same' },
    ],
  },
];
