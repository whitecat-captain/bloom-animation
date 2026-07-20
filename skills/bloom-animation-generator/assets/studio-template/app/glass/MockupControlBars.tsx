"use client";

import { useState } from "react";

const MOCKUP_CONTROLS = [
  {
    id: "angle",
    label: "Golden angle",
    min: 90,
    max: 180,
    step: 0.1,
    format: (value: number) => `${value.toFixed(1)}°`,
  },
  {
    id: "bloom",
    label: "Bloom",
    min: 0,
    max: 100,
    step: 1,
    format: (value: number) => `${value}%`,
  },
  {
    id: "petals",
    label: "Petals",
    min: 5,
    max: 150,
    step: 1,
    format: (value: number) => `${value}`,
  },
] as const;

type MockupControl = (typeof MOCKUP_CONTROLS)[number];
type MockupValues = Record<MockupControl["id"], number>;

type MockupControlBarProps = {
  control: MockupControl;
  value: number;
  onValueChange: (id: MockupControl["id"], value: number) => void;
};

function MockupControlBar({
  control,
  value,
  onValueChange,
}: MockupControlBarProps) {
  return (
    <label className="glass-reference__mock-control">
      <span className="glass-reference__mock-control-name">{control.label}</span>
      <input
        type="range"
        min={control.min}
        max={control.max}
        step={control.step}
        value={value}
        onChange={(event) => onValueChange(control.id, Number(event.target.value))}
      />
      <output>{control.format(value)}</output>
    </label>
  );
}

export default function MockupControlBars() {
  const [values, setValues] = useState<MockupValues>({
    angle: 137.5,
    bloom: 72,
    petals: 36,
  });

  const updateValue = (id: MockupControl["id"], value: number) => {
    setValues((current) => ({ ...current, [id]: value }));
  };

  return (
    <div className="glass-reference__mock-controls">
      {MOCKUP_CONTROLS.map((control) => (
        <MockupControlBar
          key={control.id}
          control={control}
          value={values[control.id]}
          onValueChange={updateValue}
        />
      ))}
    </div>
  );
}
