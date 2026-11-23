import { useRef } from 'react';

export default function useRefs() {
  const nodeRef = useRef({});

  function getRef(index) {
    return nodeRef.current[index];
  }

  function setRef(index) {
    return (node) => {
      nodeRef.current[index] = node;
    };
  }

  return [getRef, setRef];
}
