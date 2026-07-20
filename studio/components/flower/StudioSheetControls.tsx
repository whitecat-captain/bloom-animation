type TwoButtonOption<T extends string> = {
  label: string;
  value: T;
};

type StudioSwitchButtonProps = {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

type StudioTwoButtonSelectProps<T extends string> = {
  label: string;
  value: T;
  options: [TwoButtonOption<T>, TwoButtonOption<T>];
  disabled?: boolean;
  onChange: (value: T) => void;
};

type StudioPaletteStripProps = {
  label: string;
  palette: [number, number, number][];
  disabled?: boolean;
  onChange: (index: number, rgb: [number, number, number]) => void;
};

const PALETTE_STOP_NAMES = ["Tip", "Outer", "Middle", "Inner", "Core"];

function rgbToHex([r, g, b]: [number, number, number]) {
  const channel = (value: number) =>
    Math.round(Math.min(Math.max(value, 0), 1) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ];
}

export function StudioSwitchButton({
  label,
  checked,
  disabled = false,
  onChange,
}: StudioSwitchButtonProps) {
  return (
    <div className="studio-sheet-control">
      <span className="studio-sheet-control-label">{label}</span>
      <span className="studio-sheet-control-value">
        <button
          type="button"
          className={`studio-switch-button${checked ? " is-checked" : ""}`}
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => onChange(!checked)}
        >
          <span className="studio-switch-button-text">
            {checked ? "On" : "Off"}
          </span>
          <span className="studio-switch-button-track" aria-hidden="true">
            <span className="studio-switch-button-thumb" />
          </span>
        </button>
      </span>
    </div>
  );
}

export function StudioTwoButtonSelect<T extends string>({
  label,
  value,
  options,
  disabled = false,
  onChange,
}: StudioTwoButtonSelectProps<T>) {
  return (
    <div className="studio-sheet-control">
      <span className="studio-sheet-control-label">{label}</span>
      <div
        className="studio-sheet-control-value studio-two-button-select"
        role="radiogroup"
        aria-label={label}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              className={`studio-two-button-select-option${
                selected ? " is-selected" : ""
              }`}
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StudioPaletteStrip({
  label,
  palette,
  disabled = false,
  onChange,
}: StudioPaletteStripProps) {
  return (
    <div className="studio-sheet-control">
      <span className="studio-sheet-control-label">{label}</span>
      <div
        className="studio-sheet-control-value studio-palette-strip"
        role="group"
        aria-label={label}
      >
        {palette.map((stop, index) => {
          const stopName = PALETTE_STOP_NAMES[index] ?? `Colour ${index + 1}`;
          return (
            <label
              key={stopName}
              className="studio-palette-swatch"
              title={stopName}
            >
              <input
                type="color"
                value={rgbToHex(stop)}
                aria-label={stopName}
                disabled={disabled}
                onChange={(event) =>
                  onChange(index, hexToRgb(event.target.value))
                }
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}
