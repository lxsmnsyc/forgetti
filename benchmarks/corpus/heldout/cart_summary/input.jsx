import { useState, useEffect, useReducer, memo } from 'react';
import { bump, Child } from '../../shared/counter.js';

// Cart state: quantity by product id, plus the order the ids were added in.
export function cartReducer(state, action) {
  bump('reduce');
  switch (action.type) {
    case 'ADD': {
      const quantity = state.quantityById[action.id] || 0;
      return {
        addedIds: quantity === 0 ? [...state.addedIds, action.id] : state.addedIds,
        quantityById: { ...state.quantityById, [action.id]: quantity + 1 },
      };
    }
    case 'REMOVE': {
      const quantityById = { ...state.quantityById };
      delete quantityById[action.id];
      return { addedIds: state.addedIds.filter((id) => id !== action.id), quantityById };
    }
    case 'CHECKOUT':
      return { addedIds: [], quantityById: {} };
    default:
      return state;
  }
}

function getTotal(products, state) {
  bump('total');
  let total = 0;
  for (const id of state.addedIds) {
    const product = products.find((p) => p.id === id);
    total += product.price * state.quantityById[id];
  }
  return total.toFixed(2);
}

function Product({ price, quantity, title }) {
  return (
    <div>
      {title} - &#36;{price}
      {quantity ? ` x ${quantity}` : null}
    </div>
  );
}

function ProductItem({ product, onAddToCartClicked }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <Product title={product.title} price={product.price} />
      <button onClick={onAddToCartClicked} disabled={product.inventory > 0 ? '' : 'disabled'}>
        {product.inventory > 0 ? 'Add to cart' : 'Sold Out'}
      </button>
    </div>
  );
}

const MemoProductItem = memo(function MemoProductItem(props) {
  bump('Row');
  return <ProductItem {...props} />;
});

function Cart({ products, total, onCheckoutClicked }) {
  const hasProducts = products.length > 0;
  const nodes = hasProducts ? (
    products.map((product) => (
      <Product
        title={product.title}
        price={product.price}
        quantity={product.quantity}
        key={product.id}
      />
    ))
  ) : (
    <em>Please add some products to cart.</em>
  );

  return (
    <div>
      <h3>Your Cart</h3>
      <div>{nodes}</div>
      <p>Total: &#36;{total}</p>
      <button onClick={onCheckoutClicked} disabled={hasProducts ? '' : 'disabled'}>
        Checkout
      </button>
    </div>
  );
}

export function Shop({ products, discount, onCheckout }) {
  const [state, dispatch] = useReducer(cartReducer, { addedIds: [], quantityById: {} });
  const [checkedOut, setCheckedOut] = useState(0);

  useEffect(() => {
    globalThis.__shop = { dispatch, setCheckedOut };
  }, []);

  // Cart lines join the product list with the quantities.
  const lines = state.addedIds.map((id) => {
    const product = products.find((p) => p.id === id);
    return { ...product, quantity: state.quantityById[id] };
  });
  const total = getTotal(products, state);
  const discounted = discount ? (total * (1 - discount)).toFixed(2) : total;

  const checkout = () => {
    if (onCheckout) {
      onCheckout(lines);
    }
    setCheckedOut((n) => n + 1);
    dispatch({ type: 'CHECKOUT' });
  };

  return (
    <div>
      <h2>Shopping Cart Example</h2>
      <h3>Products</h3>
      {products.map((product) => (
        <MemoProductItem
          key={product.id}
          product={product}
          onAddToCartClicked={() => dispatch({ type: 'ADD', id: product.id })}
        />
      ))}
      <Cart products={lines} total={discounted} onCheckoutClicked={checkout} />
      <Child v={`${checkedOut} orders`} />
    </div>
  );
}
