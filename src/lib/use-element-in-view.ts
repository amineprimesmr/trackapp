"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

type Options = {
  threshold?: number | number[];
  rootMargin?: string;
  /** Conteneur scroll (ex. stage AppLAB) — sinon viewport. */
  rootRef?: RefObject<Element | null>;
};

/**
 * Observe la visibilité d’un élément. Utilise un callback ref pour éviter le cas
 * où ref.current est encore null au premier useEffect (forwardRef enfant).
 */
export function useElementInView<T extends Element>({
  threshold = 0.12,
  rootMargin = "0px",
  rootRef,
}: Options = {}): {
  ref: (node: T | null) => void;
  inView: boolean;
} {
  const [node, setNode] = useState<T | null>(null);
  const [inView, setInView] = useState(true);

  const ref = useCallback((el: T | null) => {
    setNode(el);
  }, []);

  useEffect(() => {
    if (!node) return;

    if (!("IntersectionObserver" in window)) {
      setInView(true);
      return;
    }

    const root = rootRef?.current ?? null;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry?.isIntersecting ?? false),
      { threshold, rootMargin, root: root ?? undefined },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [node, threshold, rootMargin, rootRef]);

  return { ref, inView };
}
