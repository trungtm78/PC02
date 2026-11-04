import { useLayoutEffect, useRef, type MutableRefObject } from 'react';

/** A ref that always holds the value of the latest render, for callbacks that must not be re-created on every change. */
export function useLatest<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
