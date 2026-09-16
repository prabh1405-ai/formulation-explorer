import { useCallback, useEffect, useState } from "react";
import { generateDesign } from "./design";
import {
  defaultMaterials,
  defaultObjectives,
  emptyResults,
  type DesignKind,
  type LumoraState,
  type Material,
  type ResponseKey,
} from "./types";

const KEY = "lumora.state.v1";

const initial = (): LumoraState => ({
  materials: defaultMaterials(),
  design: "simple10",
  seed: 2026,
  trials: [],
  objectives: defaultObjectives(),
  step: 0,
});

/** Local (browser) persistence — no cloud storage involved. */
export function useLumora() {
  const [state, setState] = useState<LumoraState>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState({ ...initial(), ...(JSON.parse(raw) as LumoraState) });
    } catch {
      /* ignore corrupt local data */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify(state));
  }, [state, loaded]);

  const setMaterialCount = useCallback((n: number) => {
    setState((s) => {
      const next: Material[] = [];
      for (let i = 0; i < n; i++) {
        next.push(
          s.materials[i] ?? {
            id: `m${i + 1}-${Math.random().toString(36).slice(2, 7)}`,
            name: `Material ${i + 1}`,
            min: 1,
            max: 5,
          },
        );
      }
      return { ...s, materials: next, trials: [] };
    });
  }, []);

  const updateMaterial = useCallback((i: number, patch: Partial<Material>) => {
    setState((s) => ({
      ...s,
      materials: s.materials.map((m, j) => (j === i ? { ...m, ...patch } : m)),
      trials: [],
    }));
  }, []);

  const generate = useCallback((design: DesignKind, seed: number) => {
    setState((s) => ({
      ...s,
      design,
      seed,
      trials: generateDesign(s.materials, design, seed),
      step: 1,
    }));
  }, []);

  const setResult = useCallback(
    (trial: number, key: ResponseKey, value: number | null) => {
      setState((s) => ({
        ...s,
        trials: s.trials.map((t) =>
          t.trial === trial ? { ...t, results: { ...t.results, [key]: value } } : t,
        ),
      }));
    },
    [],
  );

  const clearResults = useCallback(() => {
    setState((s) => ({
      ...s,
      trials: s.trials.map((t) => ({ ...t, results: emptyResults() })),
    }));
  }, []);

  const setObjective = useCallback(
    (key: ResponseKey, patch: Partial<LumoraState["objectives"][ResponseKey]>) => {
      setState((s) => ({
        ...s,
        objectives: { ...s.objectives, [key]: { ...s.objectives[key], ...patch } },
      }));
    },
    [],
  );

  const setStep = useCallback((step: number) => setState((s) => ({ ...s, step })), []);
  const reset = useCallback(() => setState(initial()), []);

  return {
    state,
    loaded,
    setMaterialCount,
    updateMaterial,
    generate,
    setResult,
    clearResults,
    setObjective,
    setStep,
    reset,
    setState,
  };
}
