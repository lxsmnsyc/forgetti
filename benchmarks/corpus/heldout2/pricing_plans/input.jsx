import { forwardRef, useEffect, useRef, useState } from 'react';
import { bump } from '../../shared/counter.js';

// Stands in for the `classnames` package. Objects map a class name to a flag.
function cn(...args) {
  const parts = [];
  for (const arg of args) {
    if (typeof arg === 'string' && arg) {
      parts.push(arg);
    } else if (arg && typeof arg === 'object') {
      for (const name of Object.keys(arg)) {
        if (arg[name]) {
          parts.push(name);
        }
      }
    }
  }
  return parts.join(' ');
}

// Stands in for the `react-merge-refs` package.
function mergeRefs(refs) {
  return (value) => {
    for (const ref of refs) {
      if (typeof ref === 'function') {
        ref(value);
      } else if (ref != null) {
        ref.current = value;
      }
    }
  };
}

// The CSS module is replaced by plain class names.
const styles = { root: 'root', slim: 'slim', loading: 'loading', disabled: 'disabled' };

// components/ui/LoadingDots
function LoadingDots() {
  return (
    <span className="loading-dots">
      <span />
      <span />
      <span />
    </span>
  );
}

// components/ui/Button/Button.tsx
const Button = forwardRef((props, buttonRef) => {
  const {
    className,
    variant = 'flat',
    children,
    active,
    width,
    loading = false,
    disabled = false,
    style = {},
    Component = 'button',
    ...rest
  } = props;
  const ref = useRef(null);
  bump('Btn');
  const rootClassName = cn(
    styles.root,
    {
      [styles.slim]: variant === 'slim',
      [styles.loading]: loading,
      [styles.disabled]: disabled,
    },
    className,
  );
  return (
    <Component
      aria-pressed={active}
      data-variant={variant}
      ref={mergeRefs([ref, buttonRef])}
      className={rootClassName}
      disabled={disabled}
      style={{
        width,
        ...style,
      }}
      {...rest}
    >
      {children}
      {loading && (
        <i className="flex pl-2 m-0">
          <LoadingDots />
        </i>
      )}
    </Component>
  );
});
Button.displayName = 'Button';

// The counted calls feed their results, so a compiler that skips the work also skips the count.
function listIntervals(products) {
  bump('intervals');
  return Array.from(
    new Set(products.flatMap((product) => product?.prices?.map((price) => price?.interval))),
  );
}

function formatPrice(price) {
  bump('format');
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: price.currency,
    minimumFractionDigits: 0,
  }).format((price?.unit_amount || 0) / 100);
}

const ACTIVE = 'relative w-1/2 bg-zinc-700 border-zinc-800 shadow-sm text-white';
const IDLE = 'ml-0.5 relative w-1/2 border border-transparent text-zinc-400';
const TAB = 'rounded-md m-1 py-2 text-sm font-medium whitespace-nowrap sm:w-auto sm:px-8';

// components/ui/Pricing/Pricing.tsx. The router, the Stripe client and the session helper are
// replaced by the `onNavigate` and `checkout` props.
export default function Pricing({ user, products, subscription, onNavigate, checkout }) {
  const intervals = listIntervals(products);
  const [billingInterval, setBillingInterval] = useState('month');
  const [priceIdLoading, setPriceIdLoading] = useState();
  const currentPath = '/pricing';

  const handleStripeCheckout = async (price) => {
    setPriceIdLoading(price.id);

    if (!user) {
      setPriceIdLoading(undefined);
      return onNavigate('/signin/signup');
    }

    const { errorRedirect, sessionId } = await checkout(price, currentPath);

    if (errorRedirect) {
      setPriceIdLoading(undefined);
      return onNavigate(errorRedirect);
    }

    if (!sessionId) {
      setPriceIdLoading(undefined);
      return onNavigate(`${currentPath}?error=unknown`);
    }

    onNavigate(`/checkout/${sessionId}`);

    setPriceIdLoading(undefined);
  };

  useEffect(() => {
    globalThis.__pricing = { setBillingInterval, buy: handleStripeCheckout };
  });

  if (!products.length) {
    return (
      <section className="bg-black">
        <p className="text-4xl font-extrabold text-white sm:text-center sm:text-6xl">
          No subscription pricing plans found. Create them in your{' '}
          <a className="text-pink-500 underline" href="https://dashboard.stripe.com/products" target="_blank">
            Stripe Dashboard
          </a>
          .
        </p>
      </section>
    );
  } else {
    return (
      <section className="bg-black">
        <div className="max-w-6xl px-4 py-8 mx-auto sm:py-24 sm:px-6 lg:px-8">
          <div className="sm:flex sm:flex-col sm:align-center">
            <h1 className="text-4xl font-extrabold text-white sm:text-center sm:text-6xl">Pricing Plans</h1>
            <div className="relative self-center mt-6 bg-zinc-900 rounded-lg p-0.5 flex sm:mt-8 border border-zinc-800">
              {intervals.includes('month') && (
                <button
                  onClick={() => setBillingInterval('month')}
                  type="button"
                  className={`${billingInterval === 'month' ? ACTIVE : IDLE} ${TAB}`}
                >
                  Monthly billing
                </button>
              )}
              {intervals.includes('year') && (
                <button
                  onClick={() => setBillingInterval('year')}
                  type="button"
                  className={`${billingInterval === 'year' ? ACTIVE : IDLE} ${TAB}`}
                >
                  Yearly billing
                </button>
              )}
            </div>
          </div>
          <div className="mt-12 space-y-0 sm:mt-16 flex flex-wrap justify-center gap-6 lg:max-w-4xl lg:mx-auto xl:max-w-none xl:mx-0">
            {products.map((product) => {
              const price = product?.prices?.find((price) => price.interval === billingInterval);
              if (!price) return null;
              const priceString = formatPrice(price);
              return (
                <div
                  key={product.id}
                  className={cn(
                    'flex flex-col rounded-lg shadow-sm divide-y divide-zinc-600 bg-zinc-900',
                    {
                      'border border-pink-500': subscription
                        ? product.name === subscription?.prices?.products?.name
                        : product.name === 'Freelancer',
                    },
                    'flex-1',
                    'basis-1/3',
                    'max-w-xs',
                  )}
                >
                  <div className="p-6">
                    <h2 className="text-2xl font-semibold leading-6 text-white">{product.name}</h2>
                    <p className="mt-4 text-zinc-300">{product.description}</p>
                    <p className="mt-8">
                      <span className="text-5xl font-extrabold white">{priceString}</span>
                      <span className="text-base font-medium text-zinc-100">/{billingInterval}</span>
                    </p>
                    <Button
                      variant="slim"
                      type="button"
                      loading={priceIdLoading === price.id}
                      onClick={() => handleStripeCheckout(price)}
                      className="block w-full py-2 mt-8 text-sm font-semibold text-center text-white rounded-md hover:bg-zinc-900"
                    >
                      {subscription ? 'Manage' : 'Subscribe'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }
}
