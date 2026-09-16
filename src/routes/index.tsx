import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header, Stepper } from "@/components/lumora/Shell";
import { StepMaterials } from "@/components/lumora/StepMaterials";
import { StepDesign } from "@/components/lumora/StepDesign";
import { StepResults } from "@/components/lumora/StepResults";
import { StepProcessing } from "@/components/lumora/StepProcessing";
import { StepModels } from "@/components/lumora/StepModels";
import { StepGraphs } from "@/components/lumora/StepGraphs";
import { StepOptimize } from "@/components/lumora/StepOptimize";
import { useLumora } from "@/lib/lumora/store";
import { buildDataset, type Analysis } from "@/lib/lumora/analysis";

const TITLE = "LUMORA Formulation Optimizer — RSM Bio-Composite Analysis";
const DESCRIPTION =
  "Design bio-composite experiments, record measured results, fit RSM and machine-learning models, explore 3D response surfaces and get the optimal material blend.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: Index,
});

function Index() {
  const store = useLumora();
  const { state, loaded, setStep } = store;
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  /** Fresh measurements invalidate a previously fitted analysis. */
  const signature = JSON.stringify(state.trials.map((t) => [t.levels, t.results]));
  useEffect(() => {
    setAnalysis(null);
  }, [signature]);

  if (!loaded) {
    return (
      <main className="min-h-screen bg-background">
        <Header />
      </main>
    );
  }

  const dataset = buildDataset(state.materials, state.trials);
  const maxUnlocked = !state.trials.length
    ? 1
    : !dataset.ready
      ? 2
      : analysis
        ? 6
        : 3;
  const step = Math.min(state.step, maxUnlocked);

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <Stepper step={step} maxUnlocked={maxUnlocked} onSelect={setStep} />
      <div className="mx-auto max-w-6xl px-4 pb-20">
        {step === 0 ? <StepMaterials store={store} onNext={() => setStep(1)} /> : null}
        {step === 1 ? <StepDesign store={store} onNext={() => setStep(2)} /> : null}
        {step === 2 ? <StepResults store={store} onNext={() => setStep(3)} /> : null}
        {step === 3 ? (
          <StepProcessing
            store={store}
            analysis={analysis}
            onAnalysis={setAnalysis}
            onNext={() => setStep(4)}
          />
        ) : null}
        {step === 4 ? <StepModels analysis={analysis} onNext={() => setStep(5)} /> : null}
        {step === 5 ? <StepGraphs analysis={analysis} onNext={() => setStep(6)} /> : null}
        {step === 6 ? <StepOptimize store={store} analysis={analysis} /> : null}
      </div>
    </main>
  );
}
