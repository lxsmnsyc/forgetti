import Flex from './flex.jsx';

import { getTileClasses } from './utils.js';

export default function TileGroup({
  className,
  count = 3,
  dateTransform,
  dateType,
  end,
  hover,
  offset,
  renderTile,
  start,
  step = 1,
  value,
  valueType,
}) {
  const tiles = [];
  for (let point = start; point <= end; point += step) {
    const date = dateTransform(point);

    tiles.push(
      renderTile({
        classes: getTileClasses({
          date,
          dateType,
          hover,
          value,
          valueType,
        }),
        date,
      }),
    );
  }

  return (
    <Flex className={className} count={count} offset={offset} wrap>
      {tiles}
    </Flex>
  );
}
