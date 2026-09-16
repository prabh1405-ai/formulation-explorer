export type Material = {
  id: string;
  name: string;
  min: number;
  max: number;
};

export const RESPONSES = [
  { key: "hardness", label: "Hardness" },
  { key: "breakResistance", label: "Break Resistance" },
  { key: "flexibility", label: "Flexibility" },
  { key: "oilWicking", label: "Oil Wicking" },
  { key: "breakdown", label: "Water Breakdown" },
  { key: "weightBalance", label: "Weight Balance" },
] as const;

export type ResponseKey = (typeof RESPONSES)[number]["key"];

export type Trial = {
  trial: number;
  /** grams per material, aligned with materials[] order */
  levels: number[];
  /** measured responses in %, null when not yet measured */
  results: Record<ResponseKey, number | null>;
};

export type DesignKind = "simple10" | "ccd" | "bbd";

export type Objective = "max" | "min" | "target";

export type ObjectiveSpec = {
  goal: Objective;
  target: number;
  /** minimum acceptable value used for pass/fail classification */
  threshold: number;
  weight: number;
};

export type LumoraState = {
  materials: Material[];
  design: DesignKind;
  seed: number;
  trials: Trial[];
  objectives: Record<ResponseKey, ObjectiveSpec>;
  step: number;
};

export const emptyResults = (): Record<ResponseKey, number | null> =>
  RESPONSES.reduce(
    (acc, r) => ({ ...acc, [r.key]: null }),
    {} as Record<ResponseKey, number | null>,
  );

export const defaultObjectives = (): Record<ResponseKey, ObjectiveSpec> => ({
  hardness: { goal: "max", target: 90, threshold: 70, weight: 1 },
  breakResistance: { goal: "max", target: 90, threshold: 70, weight: 1 },
  flexibility: { goal: "max", target: 85, threshold: 60, weight: 1 },
  oilWicking: { goal: "max", target: 95, threshold: 70, weight: 1 },
  breakdown: { goal: "target", target: 75, threshold: 60, weight: 1 },
  weightBalance: { goal: "target", target: 90, threshold: 70, weight: 1 },
});

export const defaultMaterials = (): Material[] => [
  { id: "m1", name: "Banana Fiber", min: 2, max: 6 },
  { id: "m2", name: "Rice Husk", min: 1, max: 4 },
  { id: "m3", name: "Binder", min: 1, max: 5 },
  { id: "m4", name: "Glycerol", min: 0.5, max: 2 },
];
