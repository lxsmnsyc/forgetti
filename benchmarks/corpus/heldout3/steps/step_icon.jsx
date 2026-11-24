import { createContext, forwardRef, useContext } from 'react';
import { bump } from '../../shared/counter.js';
import { clsx, pickAttrs } from './util.js';
import { StepsContext } from './context.js';

export const StepIconSemanticContext = createContext({});

const StepIcon = forwardRef((props, ref) => {
  bump('Child');
  const { className, style, children, ...restProps } = props;

  const { prefixCls, classNames, styles } = useContext(StepsContext);
  const { className: itemClassName, style: itemStyle } = useContext(StepIconSemanticContext);

  const itemCls = `${prefixCls}-item`;

  return (
    <div
      {...pickAttrs(restProps, false)}
      ref={ref}
      className={clsx(`${itemCls}-icon`, classNames.itemIcon, itemClassName, className)}
      style={{ ...styles.itemIcon, ...itemStyle, ...style }}
    >
      {children}
    </div>
  );
});

export default StepIcon;
