import { useRef, useEffect } from 'preact/hooks';

export default function useWhy<T>(name: string, value: T) {
  const prev = useRef<T>();
  useEffect(() => {
    if (prev.current) {
      if (!Object.is(prev.current, value)) {
        console.log('[why-did-you-update]', name, prev.current, value);
      }
    }
    // Finally update previousProps with current props for next hook call
    prev.current = value;
  });
}
