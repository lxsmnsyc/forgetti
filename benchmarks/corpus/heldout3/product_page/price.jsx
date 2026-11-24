import { bump } from '../../shared/counter.js';
import clsx from './util.jsx';

const Price = ({ amount, className, currencyCode = 'USD', currencyCodeClassName }) => {
  bump('Child');
  return (
    <p suppressHydrationWarning={true} className={className}>
      {`${new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currencyCode,
        currencyDisplay: 'narrowSymbol',
      }).format(parseFloat(amount))}`}
      <span className={clsx('ml-1 inline', currencyCodeClassName)}>{`${currencyCode}`}</span>
    </p>
  );
};

export default Price;
