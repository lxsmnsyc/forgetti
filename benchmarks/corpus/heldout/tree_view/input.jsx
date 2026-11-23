import { useState, useEffect, useReducer, useCallback, memo } from 'react';
import { bump } from '../../shared/counter.js';

// The tree is a flat map of nodes by id, as in the redux tree-view example.
export function treeReducer(state, action) {
  bump('reduce');
  switch (action.type) {
    case 'INCREMENT':
      return { ...state, [action.nodeId]: { ...state[action.nodeId], counter: state[action.nodeId].counter + 1 } };
    case 'ADD_CHILD': {
      const parent = state[action.nodeId];
      return {
        ...state,
        [action.nodeId]: { ...parent, childIds: [...parent.childIds, action.childId] },
        [action.childId]: { id: action.childId, counter: 0, childIds: [] },
      };
    }
    case 'REMOVE_CHILD': {
      const parent = state[action.nodeId];
      return {
        ...state,
        [action.nodeId]: { ...parent, childIds: parent.childIds.filter((id) => id !== action.childId) },
      };
    }
    default:
      return state;
  }
}

function getDescendantIds(tree, nodeId) {
  bump('walk');
  let ids = [];
  for (const childId of tree[nodeId].childIds) {
    ids = [...ids, childId, ...getDescendantIds(tree, childId)];
  }
  return ids;
}

const Node = memo(function Node({ tree, id, parentId, dispatch, depth }) {
  bump('Row');
  const [open, setOpen] = useState(depth < 2);
  const node = tree[id];

  const increment = useCallback(() => dispatch({ type: 'INCREMENT', nodeId: id }), [dispatch, id]);

  const addChild = (e) => {
    e.preventDefault();
    // New ids continue after the largest id in the whole tree.
    const childId = Math.max(...Object.keys(tree).map(Number)) + 1;
    dispatch({ type: 'ADD_CHILD', nodeId: id, childId });
    setOpen(true);
  };

  const remove = (e) => {
    e.preventDefault();
    dispatch({ type: 'REMOVE_CHILD', nodeId: parentId, childId: id });
  };

  const childCount = node.childIds.length;

  return (
    <div>
      {id === 0 ? null : (
        <button onClick={() => setOpen(!open)}>{open ? '-' : '+'}</button>
      )}
      Counter: {node.counter}{' '}
      <button onClick={increment}>+</button>{' '}
      {id === 0 ? null : (
        <a href="#" onClick={remove} style={{ color: 'lightgray', textDecoration: 'none' }}>
          x
        </a>
      )}
      {open ? (
        <ul>
          {node.childIds.map((childId) => (
            <li key={childId}>
              <Node tree={tree} id={childId} parentId={id} dispatch={dispatch} depth={depth + 1} />
            </li>
          ))}
          <li key="add">
            <a href="#" onClick={addChild}>
              Add child
            </a>
          </li>
        </ul>
      ) : (
        <span>{childCount} children</span>
      )}
    </div>
  );
});

export function TreeView({ initial, title }) {
  const [tree, dispatch] = useReducer(treeReducer, initial);

  useEffect(() => {
    globalThis.__tree = { dispatch };
  }, []);

  const total = getDescendantIds(tree, 0).length;

  return (
    <section>
      <h4>{title}</h4>
      <Node tree={tree} id={0} parentId={null} dispatch={dispatch} depth={0} />
      <p>{total} descendants</p>
    </section>
  );
}
