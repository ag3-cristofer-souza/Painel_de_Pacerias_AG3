import { useEffect, useState } from "react";

/** O valor só muda depois de `delay` ms sem mudanças (busca enquanto digita, sem um pedido por tecla). */
export function useDebounced<T>(value: T, delay = 300): T {
  const [current, setCurrent] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setCurrent(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return current;
}
