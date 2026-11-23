import { forwardRef, memo } from 'react';

// The same tree twice: once under a memo boundary that re-renders, once with no memo.
// `cfg` stays the same object across steps, so a compiler that caches `<Mid {...cfg} />`
// on `cfg` skips the hazard below it, though `Box` and `Parent` render again.
const HazardA = forwardRef(({ k }, ref) => <i ref={ref}>a{k}</i>);
const MidA = ({ label }) => (
  <b>
    {label}
    <HazardA k={label} />
  </b>
);
function ParentA({ n, cfg }) {
  return (
    <p>
      {n}
      {cfg && <MidA {...cfg} />}
    </p>
  );
}
const Box = memo(function Box({ n, cfg }) {
  return <ParentA n={n} cfg={cfg} />;
});
export function WithMemo({ n, cfg }) {
  return <Box n={n} cfg={cfg} />;
}

const HazardB = forwardRef(({ k }, ref) => <i ref={ref}>b{k}</i>);
const MidB = ({ label }) => (
  <b>
    {label}
    <HazardB k={label} />
  </b>
);
export function NoMemo({ n, cfg }) {
  return (
    <p>
      {n}
      {cfg && <MidB {...cfg} />}
    </p>
  );
}
