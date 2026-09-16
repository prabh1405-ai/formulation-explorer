import { RESPONSES, type Material, type Trial } from "./types";

export function trialsToCsv(materials: Material[], trials: Trial[]) {
  const header = [
    "Trial",
    ...materials.map((m) => `${m.name} (g)`),
    ...RESPONSES.map((r) => `${r.label} (%)`),
  ];
  const rows = trials.map((t) => [
    t.trial,
    ...t.levels,
    ...RESPONSES.map((r) => t.results[r.key] ?? ""),
  ]);
  return [header, ...rows].map((r) => r.join(",")).join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
