import { phases } from '../../shared/scenarios.js';

export default phases(
  'JsxProps',
  { cls: 'c', x: 1, y: 2 },
  {
    one_cls: { cls: 'd', x: 1, y: 2 },
    one_x: { cls: 'c', x: 9, y: 2 },
  },
);
