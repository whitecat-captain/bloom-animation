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
