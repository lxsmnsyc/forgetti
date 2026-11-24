/* eslint react/prop-types: 0 */
import { useContext } from 'react';
import { bump } from '../../shared/counter.js';
import { clsx, isNonNullable } from './util.js';
import Rail from './rail.jsx';
import { UnstableContext } from './unstable_context.js';
import StepIcon, { StepIconSemanticContext } from './step_icon.jsx';
import { StepsContext } from './context.js';

export default function Step(props) {
  bump('Row');
  const {
    // style
    prefixCls,
    classNames,
    styles,

    // data
    data,
    last,
    nextStatus,
    active,
    index,

    // render
    itemRender,
    iconRender,
    itemWrapperRender,

    // events
    onClick,
  } = props;

  const itemCls = `${prefixCls}-item`;

  // ======================== Contexts ========================
  const { railFollowPrevStatus } = useContext(UnstableContext);
  const { ItemComponent } = useContext(StepsContext);

  // ========================== Data ==========================
  const {
    onClick: onItemClick,
    title,
    subTitle,
    content,
    description,
    disabled,
    icon,
    status,

    className,
    style,
    classNames: itemClassNames = {},
    styles: itemStyles = {},

    ...restItemProps
  } = data;

  const mergedContent = content ?? description;

  const renderInfo = {
    item: {
      ...data,
      content: mergedContent,
    },
    index,
    active,
  };

  // ========================= Click ==========================
  const clickable = !!(onClick || onItemClick) && !disabled;

  const accessibilityProps = {};

  if (clickable) {
    accessibilityProps.role = 'button';
    accessibilityProps.tabIndex = 0;
    accessibilityProps.onClick = (e) => {
      onItemClick?.(e);
      onClick?.(index);
    };

    accessibilityProps.onKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.currentTarget.click();
      }
    };
  }

  // ========================= Render =========================
  const mergedStatus = status || 'wait';

  const hasTitle = isNonNullable(title);
  const hasSubTitle = isNonNullable(subTitle);

  const classString = clsx(
    itemCls,
    `${itemCls}-${mergedStatus}`,
    {
      [`${itemCls}-custom`]: icon,
      [`${itemCls}-active`]: active,
      [`${itemCls}-disabled`]: disabled === true,
      [`${itemCls}-empty-header`]: !hasTitle && !hasSubTitle,
    },
    className,
    classNames.item,
    itemClassNames.root,
  );

  let iconNode = <StepIcon />;
  if (iconRender) {
    iconNode = iconRender(iconNode, {
      ...renderInfo,
      components: {
        Icon: StepIcon,
      },
    });
  }

  const wrapperNode = (
    <div
      className={clsx(`${itemCls}-wrapper`, classNames.itemWrapper, itemClassNames.wrapper)}
      style={{ ...styles.itemWrapper, ...itemStyles.wrapper }}
    >
      {/* Icon */}
      <StepIconSemanticContext.Provider
        value={{
          className: itemClassNames.icon,
          style: itemStyles.icon,
        }}
      >
        {iconNode}
      </StepIconSemanticContext.Provider>

      <div
        className={clsx(`${itemCls}-section`, classNames.itemSection, itemClassNames.section)}
        style={{ ...styles.itemSection, ...itemStyles.section }}
      >
        <div
          className={clsx(`${itemCls}-header`, classNames.itemHeader, itemClassNames.header)}
          style={{ ...styles.itemHeader, ...itemStyles.header }}
        >
          {hasTitle && (
            <div
              className={clsx(`${itemCls}-title`, classNames.itemTitle, itemClassNames.title)}
              style={{ ...styles.itemTitle, ...itemStyles.title }}
            >
              {title}
            </div>
          )}
          {hasSubTitle && (
            <div
              title={typeof subTitle === 'string' ? subTitle : undefined}
              className={clsx(
                `${itemCls}-subtitle`,
                classNames.itemSubtitle,
                itemClassNames.subtitle,
              )}
              style={{ ...styles.itemSubtitle, ...itemStyles.subtitle }}
            >
              {subTitle}
            </div>
          )}

          {!last && (
            <Rail
              prefixCls={itemCls}
              className={clsx(classNames.itemRail, itemClassNames.rail)}
              style={{ ...styles.itemRail, ...itemStyles.rail }}
              status={railFollowPrevStatus ? status : nextStatus}
            />
          )}
        </div>
        {isNonNullable(mergedContent) && (
          <div
            className={clsx(`${itemCls}-content`, classNames.itemContent, itemClassNames.content)}
            style={{ ...styles.itemContent, ...itemStyles.content }}
          >
            {mergedContent}
          </div>
        )}
      </div>
    </div>
  );

  let stepNode = (
    <ItemComponent
      {...restItemProps}
      {...accessibilityProps}
      className={classString}
      style={{
        ...styles.item,
        ...itemStyles.root,
        ...style,
      }}
    >
      {itemWrapperRender ? itemWrapperRender(wrapperNode) : wrapperNode}
    </ItemComponent>
  );

  if (itemRender) {
    stepNode = itemRender(stepNode, renderInfo) || null;
  }

  return stepNode;
}
