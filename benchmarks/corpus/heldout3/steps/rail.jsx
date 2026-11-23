import { clsx } from './util.js';

export default function Rail(props) {
  const { prefixCls, className, style, status } = props;
  const railCls = `${prefixCls}-rail`;

  // ============================= render =============================
  return <div className={clsx(railCls, `${railCls}-${status}`, className)} style={style} />;
}
