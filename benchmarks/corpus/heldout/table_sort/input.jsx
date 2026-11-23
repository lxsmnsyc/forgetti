import { useState, useMemo, useEffect } from 'react';
import { bump, Btn, Child } from '../../shared/counter.js';

const STATUS_ORDER = ['single', 'complicated', 'relationship'];

// Compares two rows on one column. Enum and number columns use their own order.
function compareValues(column, a, b) {
  const left = a[column.id];
  const right = b[column.id];
  if (left === undefined || left === null) {
    return right === undefined || right === null ? 0 : 1;
  }
  if (right === undefined || right === null) {
    return -1;
  }
  if (column.id === 'status') {
    return STATUS_ORDER.indexOf(left) - STATUS_ORDER.indexOf(right);
  }
  if (typeof left === 'number') {
    return left - right;
  }
  return String(left).localeCompare(String(right));
}

function sortRows(rows, columns, sorting) {
  bump('sort');
  const result = rows.slice();
  result.sort((a, b) => {
    for (const rule of sorting) {
      const column = columns.find((c) => c.id === rule.id);
      let diff = compareValues(column, a, b);
      if (column.invert) {
        diff = -diff;
      }
      if (diff !== 0) {
        return rule.desc ? -diff : diff;
      }
    }
    return 0;
  });
  return result;
}

// Cycles one column through asc, desc and unsorted. Shift keeps the other sorted columns.
function toggleSort(sorting, column, multi) {
  const current = sorting.find((s) => s.id === column.id);
  let next;
  if (current === undefined) {
    next = { id: column.id, desc: column.descFirst === true };
  } else if (current.desc === (column.descFirst === true)) {
    next = { id: column.id, desc: !current.desc };
  } else {
    next = null;
  }
  const others = multi ? sorting.filter((s) => s.id !== column.id) : [];
  return next === null ? others : [...others, next];
}

function SortHeader({ column, sorting, onSort }) {
  const rule = sorting.find((s) => s.id === column.id);
  const index = sorting.indexOf(rule);
  let mark = '';
  if (rule) {
    mark = rule.desc ? ' v' : ' ^';
    if (sorting.length > 1) {
      mark += index + 1;
    }
  }
  return (
    <th key={column.id} colSpan={1}>
      {column.sortable === false ? (
        column.header
      ) : (
        <Btn onClick={() => onSort(column)} label={column.header + mark} />
      )}
    </th>
  );
}

export function SortTable({ rows, columns, initialSorting, pageSize }) {
  const [sorting, setSorting] = useState(initialSorting || []);
  const [multi, setMulti] = useState(false);

  useEffect(() => {
    globalThis.__setSorting = setSorting;
    globalThis.__setMulti = setMulti;
  }, []);

  const sorted = useMemo(() => sortRows(rows, columns, sorting), [rows, columns, sorting]);
  const visible = sorted.slice(0, pageSize || 10);

  const onSort = (column) => setSorting((old) => toggleSort(old, column, multi));
  const clear = () => setSorting([]);

  const summary = {
    total: rows.length,
    shown: visible.length,
    sortedBy: sorting.map((s) => s.id + (s.desc ? ':desc' : ':asc')).join(','),
  };

  return (
    <div className="p-2">
      <label>
        <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} />
        multi
      </label>
      <Btn onClick={clear} label="clear" />
      <table>
        <thead>
          <tr>
            <th>#</th>
            {columns.map((column) => (
              <SortHeader key={column.id} column={column} sorting={sorting} onSort={onSort} />
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, i) => (
            <tr key={row.id}>
              <td>{i + 1}</td>
              {columns.map((column) => (
                <td key={column.id}>
                  <Child v={row[column.id] === undefined ? '-' : String(row[column.id])} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        {summary.shown} of {summary.total} rows, sorted by {summary.sortedBy || 'nothing'}
      </p>
    </div>
  );
}
