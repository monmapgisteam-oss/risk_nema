"use client";

import { useEffect, useMemo, useState } from "react";
import { OVERLAYS, type Mode } from "@/lib/riskConfig";
import {
  loadObjectDistribution,
  type ObjectDistribution,
} from "@/lib/objectClass";

type Args = {
  mode: Mode;
  hazard: string;
  /** Object layers on the map. */
  overlays: string[];
  /** Soum codes the map shows objects of (null = every soum). */
  codes: number[] | null;
  /** Aimag or soums chosen: the map colours objects by their own class. */
  areaFocus: boolean;
};

type Result = {
  key: string;
  data: Record<string, ObjectDistribution>;
  error: boolean;
};

/**
 * Class counts (and object ids per class) of the object layers on the map,
 * counted the way the map draws them. `data` is null while loading.
 */
export function useObjectDistribution({
  mode,
  hazard,
  overlays,
  codes,
  areaFocus,
}: Args) {
  const layers = useMemo(
    () => OVERLAYS[mode].filter((o) => overlays.includes(o.id)),
    [mode, overlays],
  );
  const key = JSON.stringify([
    mode,
    hazard,
    areaFocus,
    codes,
    layers.map((o) => o.id),
  ]);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!layers.length) return;
    const ctrl = new AbortController();
    Promise.all(
      layers.map((o) =>
        loadObjectDistribution(o, mode, hazard, areaFocus, codes, ctrl.signal),
      ),
    )
      .then((list) =>
        setResult({
          key,
          data: Object.fromEntries(layers.map((o, i) => [o.id, list[i]])),
          error: false,
        }),
      )
      .catch(() => {
        if (!ctrl.signal.aborted) setResult({ key, data: {}, error: true });
      });
    return () => ctrl.abort();
  }, [key, layers, mode, hazard, areaFocus, codes]);

  const ready = result?.key === key ? result : null;
  return {
    layers,
    data: ready && !ready.error ? ready.data : null,
    loading: layers.length > 0 && !ready,
    error: !!ready?.error,
  };
}

export type ObjectDistributionState = ReturnType<typeof useObjectDistribution>;
