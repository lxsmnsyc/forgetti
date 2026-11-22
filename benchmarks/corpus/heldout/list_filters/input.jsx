import { memo, useState, useMemo, useCallback, useEffect, useReducer } from 'react';
import { bump } from '../../shared/counter.js';

const ADD_ITEM = 'ADD_ITEM';
const TOGGLE_ITEM = 'TOGGLE_ITEM';
const REMOVE_ITEM = 'REMOVE_ITEM';
const UPDATE_ITEM = 'UPDATE_ITEM';
const TOGGLE_ALL = 'TOGGLE_ALL';
const CLEAR_COMPLETED = 'CLEAR_COMPLETED';

export function todoReducer(state, action) {
  bump('reduce');
  switch (action.type) {
    case ADD_ITEM:
      return [...state, { id: action.payload.id, title: action.payload.title, completed: false }];
    case TOGGLE_ITEM:
      return state.map((todo) =>
        todo.id === action.payload.id ? { ...todo, completed: !todo.completed } : todo,
      );
    case UPDATE_ITEM:
      return state.map((todo) =>
        todo.id === action.payload.id ? { ...todo, title: action.payload.title } : todo,
      );
    case REMOVE_ITEM:
      return state.filter((todo) => todo.id !== action.payload.id);
    case TOGGLE_ALL:
      return state.map((todo) => ({ ...todo, completed: action.payload.completed }));
    case CLEAR_COMPLETED:
      return state.filter((todo) => !todo.completed);
    default:
      throw new Error(`Unknown action: ${action.type}`);
  }
}

const Item = memo(function Item({ todo, dispatch }) {
  bump('Row');
  const [isWritable, setIsWritable] = useState(false);
  const { title, completed, id } = todo;

  const toggleItem = useCallback(() => dispatch({ type: TOGGLE_ITEM, payload: { id } }), [dispatch, id]);
  const removeItem = useCallback(() => dispatch({ type: REMOVE_ITEM, payload: { id } }), [dispatch, id]);
  const updateItem = useCallback(
    (newTitle) => dispatch({ type: UPDATE_ITEM, payload: { id, title: newTitle } }),
    [dispatch, id],
  );

  const commitEdit = useCallback(
    (newTitle) => {
      // Enter then blur would otherwise dispatch twice.
      if (!isWritable) {
        return;
      }
      setIsWritable(false);
      if (newTitle.length === 0) {
        removeItem();
      } else {
        updateItem(newTitle);
      }
    },
    [isWritable, removeItem, updateItem],
  );

  return (
    <li className={(completed ? 'completed ' : '') + (isWritable ? 'editing' : '')}>
      <div className="view">
        <input className="toggle" type="checkbox" checked={completed} onChange={toggleItem} />
        <label onDoubleClick={() => setIsWritable(true)}>{title}</label>
        <button className="destroy" aria-label="Delete todo" onClick={removeItem} />
      </div>
      {isWritable && (
        <input
          className="edit"
          defaultValue={title}
          onBlur={(e) => commitEdit(e.target.value.trim())}
          onKeyDown={(e) => e.key === 'Enter' && commitEdit(e.target.value.trim())}
        />
      )}
    </li>
  );
});

function Footer({ todos, route, dispatch }) {
  const activeCount = todos.filter((todo) => !todo.completed).length;
  if (todos.length === 0) {
    return null;
  }
  return (
    <footer className="footer">
      <span className="todo-count">
        <strong>{activeCount}</strong> {activeCount === 1 ? 'item' : 'items'} left!
      </span>
      <ul className="filters">
        {['/', '/active', '/completed'].map((path) => (
          <li key={path}>
            <a className={route === path ? 'selected' : ''} href={`#${path}`}>
              {path === '/' ? 'All' : path.slice(1)}
            </a>
          </li>
        ))}
      </ul>
      <button
        className="clear-completed"
        disabled={activeCount === todos.length}
        onClick={() => dispatch({ type: CLEAR_COMPLETED })}
      >
        Clear completed
      </button>
    </footer>
  );
}

export function TodoApp({ initial, route, nextId }) {
  const [todos, dispatch] = useReducer(todoReducer, initial);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    globalThis.__todo = { dispatch, setDraft };
  }, [dispatch]);

  const visibleTodos = useMemo(
    () =>
      todos.filter((todo) => {
        if (route === '/active') {
          return !todo.completed;
        }
        if (route === '/completed') {
          return todo.completed;
        }
        return true;
      }),
    [todos, route],
  );

  const toggleAll = useCallback(
    (e) => dispatch({ type: TOGGLE_ALL, payload: { completed: e.target.checked } }),
    [],
  );

  const add = (e) => {
    e.preventDefault();
    if (draft.trim().length > 0) {
      dispatch({ type: ADD_ITEM, payload: { id: nextId + todos.length, title: draft.trim() } });
      setDraft('');
    }
  };

  return (
    <section className="todoapp">
      <form onSubmit={add}>
        <input className="new-todo" value={draft} onChange={(e) => setDraft(e.target.value)} />
      </form>
      <main className="main" hidden={todos.length === 0}>
        <input
          className="toggle-all"
          type="checkbox"
          checked={visibleTodos.length > 0 && visibleTodos.every((todo) => todo.completed)}
          onChange={toggleAll}
        />
        <ul className="todo-list">
          {visibleTodos.map((todo) => (
            <Item todo={todo} key={todo.id} dispatch={dispatch} />
          ))}
        </ul>
      </main>
      <Footer todos={todos} route={route} dispatch={dispatch} />
    </section>
  );
}
