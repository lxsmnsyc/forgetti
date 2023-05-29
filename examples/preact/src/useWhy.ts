/* @forgetti skip */
function useWhy<T>(name: string, value: T): void {
  console.log('[why-did-you-update]', name, value);
}

export default useWhy;
