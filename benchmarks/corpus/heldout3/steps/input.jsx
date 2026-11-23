/* eslint react/no-did-mount-set-state: 0, react/prop-types: 0 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { bump } from '../../shared/counter.js';
import { clsx } from './util.js';
import Step from './step.jsx';
import { StepsContext } from './context.js';
import { UnstableContext } from './unstable_context.js';

export { UnstableContext };

const EmptyObject = {};

export default function Steps(props) {
  const {
    // style
    prefixCls = 'rc-steps',
    style,
    className,
    classNames = EmptyObject,
    styles = EmptyObject,
    rootClassName,

    // layout
    orientation,
    titlePlacement,
    components,

    // data
    status = 'process',
    current = 0,
    initial = 0,
    onChange,
    items,

    // render
    iconRender,
    itemRender,
    itemWrapperRender,

    ...restProps
  } = props;

  // ============================= layout =============================
  const isVertical = orientation === 'vertical';
  const mergedOrientation = isVertical ? 'vertical' : 'horizontal';
  const mergeTitlePlacement =
    !isVertical && titlePlacement === 'vertical' ? 'vertical' : 'horizontal';

  // ============================= styles =============================
  const classString = clsx(
    prefixCls,
    `${prefixCls}-${mergedOrientation}`,
    `${prefixCls}-title-${mergeTitlePlacement}`,
    rootClassName,
    className,
    classNames.root,
  );

  // ============================== Data ==============================
  const mergedItems = useMemo(() => (items || []).filter(Boolean), [items]);
  const statuses = useMemo(
    () =>
      mergedItems.map(({ status: itemStatus }, index) => {
        const stepNumber = initial + index;

        if (!itemStatus) {
          if (stepNumber === current) {
            return status;
          } else if (stepNumber < current) {
            return 'finish';
          }
          return 'wait';
        }

        return itemStatus;
      }),
    [mergedItems, status, current, initial],
  );

  // ============================= events =============================
  const onStepClick = (next) => {
    if (onChange && current !== next) {
      onChange(next);
    }
  };

  // =========================== components ===========================
  const { root: RootComponent = 'div', item: ItemComponent = 'div' } = components || {};

  // ============================ contexts ============================
  const stepIconContext = useMemo(
    () => ({
      prefixCls,
      classNames,
      styles,
      ItemComponent,
    }),
    [prefixCls, classNames, styles, ItemComponent],
  );

  // ============================= render =============================
  const renderStep = (item, index) => {
    const stepIndex = initial + index;

    const itemStatus = statuses[index];
    const nextStatus = statuses[index + 1];

    const data = {
      ...item,
      status: itemStatus,
    };

    return (
      <Step
        key={stepIndex}
        // Style
        prefixCls={prefixCls}
        classNames={classNames}
        styles={styles}
        // Data
        data={data}
        nextStatus={nextStatus}
        active={stepIndex === current}
        index={stepIndex}
        last={mergedItems.length - 1 === index}
        // Render
        iconRender={iconRender}
        itemRender={itemRender}
        itemWrapperRender={itemWrapperRender}
        onClick={onChange && onStepClick}
      />
    );
  };

  return (
    <RootComponent
      className={classString}
      style={{
        ...style,
        ...styles?.root,
      }}
      {...restProps}
    >
      <StepsContext.Provider value={stepIconContext}>
        {mergedItems.map(renderStep)}
      </StepsContext.Provider>
    </RootComponent>
  );
}

// The counted call feeds the result, so a compiler that skips the work also skips the count.
function countDone(items, current) {
  bump('progress');
  let done = 0;
  for (const [index, item] of items.entries()) {
    if (item.status === 'finish' || (!item.status && index < current)) {
      done += 1;
    }
  }
  return done;
}

// Harness entry, after the rc-steps demos: a checkout flow whose steps can be clicked.
export function CheckoutSteps({
  items,
  initialCurrent,
  status,
  orientation,
  titlePlacement,
  clickable,
  classNames,
  itemRender,
}) {
  const [current, setCurrent] = useState(initialCurrent);
  const rootRef = useRef(null);

  useEffect(() => {
    globalThis.__steps = { root: rootRef.current, setCurrent };
  });

  const done = useMemo(() => countDone(items, current), [items, current]);

  return (
    <div ref={rootRef}>
      <Steps
        items={items}
        current={current}
        status={status}
        orientation={orientation}
        titlePlacement={titlePlacement}
        classNames={classNames}
        itemRender={itemRender}
        onChange={clickable ? setCurrent : undefined}
        aria-label="Checkout"
      />
      <p>
        {done} of {items.length} done
      </p>
    </div>
  );
}
