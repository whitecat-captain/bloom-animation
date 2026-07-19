# FlowerSpec

Create this compact, image-derived specification before implementing a flower. It is a design decision record, not an exhaustive parameter dump.

```ts
type Fidelity = "direct" | "approximate" | "unsupported";

type FlowerSpec = {
  referenceSummary: string;
  structureFamily: "compact-rosette" | "dense-rosette" | "radiating" | "open-cup";
  silhouette: "round" | "domed" | "flat" | "starburst" | "drooping";
  petalProfile: "rounded" | "lance" | "strap" | "ruffled";
  density: "sparse" | "medium" | "dense";
  openness: "bud" | "half-open" | "open";
  centerTreatment: "hidden" | "soft-core" | "bright-core";
  palette: {
    rim: string;
    petal: string;
    core: string;
    background: string;
  };
  motion: "still" | "gentle-breeze" | "blooming";
  fidelity: Record<string, Fidelity>;
  approximationNote: string;
};
```

## Interpretation rules

- Use `compact-rosette` for tightly layered, round flowers whose centre is mostly concealed.
- Use `dense-rosette` for many visible layers, often with long or recurved petals.
- Use `radiating` for a disc-like centre with rays spreading outward.
- Use `open-cup` for a small number of broad petals that reveal an open centre.
- Use `soft-core` when the centre can be represented by smaller, partially opened instances of the shared petal. Use `bright-core` when colour, rather than separate anatomy, carries the centre.
- Write an approximation note whenever the reference requires a separate organ, a second petal shape, or strongly asymmetric anatomy.

## Required decision

Pick the closest visual structure, then adjust it. Do not create a new family merely because the reference has a different flower name.
