import { useEffect, useMemo, useRef, useState } from 'react';
import { bump } from '../../shared/counter.js';
import { AddToCart } from './add_to_cart.jsx';
import { CartProvider, useCart } from './cart_context.jsx';
import { NavigationContext } from './navigation.jsx';
import Price from './price.jsx';
import Prose from './prose.jsx';
import clsx, { ShoppingCartIcon } from './util.jsx';
import { VariantSelector } from './variant_selector.jsx';

// components/product/product-description.tsx
export function ProductDescription({ product }) {
  return (
    <>
      <div className="mb-6 flex flex-col border-b pb-6 dark:border-neutral-700">
        <h1 className="mb-2 text-5xl font-medium">{product.title}</h1>
        <div className="mr-auto w-auto rounded-full bg-blue-600 p-2 text-sm text-white">
          <Price
            amount={product.priceRange.maxVariantPrice.amount}
            currencyCode={product.priceRange.maxVariantPrice.currencyCode}
          />
        </div>
      </div>
      <VariantSelector options={product.options} variants={product.variants} />
      {product.descriptionHtml ? (
        <Prose
          className="mb-6 text-sm leading-tight dark:text-white/[60%]"
          html={product.descriptionHtml}
        />
      ) : null}
      <AddToCart product={product} />
    </>
  );
}

// components/cart/open-cart.tsx
function OpenCart({ className, quantity }) {
  return (
    <div className="relative flex h-11 w-11 items-center justify-center rounded-md border border-neutral-200 text-black transition-colors dark:border-neutral-700 dark:text-white">
      <ShoppingCartIcon className={clsx('h-4 transition-all ease-in-out hover:scale-110', className)} />

      {quantity ? (
        <div className="absolute right-0 top-0 -mr-2 -mt-2 h-4 w-4 rounded-sm bg-blue-600 text-[11px] font-medium text-white">
          {quantity}
        </div>
      ) : null}
    </div>
  );
}

// The cart button of components/cart/modal.tsx, without the dialog.
function CartButton() {
  const { cart } = useCart();
  return (
    <button aria-label="Open cart" type="button">
      <OpenCart quantity={cart?.totalQuantity} />
    </button>
  );
}

// The counted call feeds the result, so a compiler that skips the work also skips the count.
function findSelectedVariant(product, search) {
  bump('variant');
  const params = new URLSearchParams(search);
  for (const variant of product.variants) {
    let matches = true;
    for (const option of variant.selectedOptions) {
      if (params.get(option.name.toLowerCase()) !== option.value) {
        matches = false;
      }
    }
    if (matches) {
      return variant;
    }
  }
  return undefined;
}

// Harness entry, after app/product/[handle]/page.tsx: the query string lives in state and
// stands in for the router, and the cart provider wraps the page as the root layout does.
export function ProductPage({ product, initialSearch, initialCart }) {
  const [search, setSearch] = useState(initialSearch);
  const rootRef = useRef(null);

  useEffect(() => {
    globalThis.__product = { root: rootRef.current, setSearch };
  });

  const navigation = useMemo(
    () => ({
      searchParams: new URLSearchParams(search),
      router: { replace: (url) => setSearch(url.slice(1)) },
    }),
    [search],
  );
  const selected = useMemo(() => findSelectedVariant(product, search), [product, search]);

  return (
    <CartProvider initialCart={initialCart}>
      <NavigationContext.Provider value={navigation}>
        <div ref={rootRef}>
          <CartButton />
          <ProductDescription product={product} />
          <p>{selected ? selected.title : 'Choose options'}</p>
        </div>
      </NavigationContext.Provider>
    </CartProvider>
  );
}
