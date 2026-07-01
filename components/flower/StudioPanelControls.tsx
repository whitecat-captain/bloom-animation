"use client";

import type {
  ButtonHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { useId, useState } from "react";

type Option<T extends string | number> = {
  label: string;
  value: T;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function PanelField({
  label,
  value,
  children,
  full = false,
  className,
}: {
  label: string;
  value?: ReactNode;
  children: ReactNode;
  full?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "studio-field studio-panel-field",
        full && "studio-panel-field--full",
        value !== undefined && "studio-panel-field--with-value",
        className,
      )}
    >
      <span className="studio-label studio-panel-label">{label}</span>
      {children}
      {value !== undefined && (
        <span className="studio-panel-field-value">{value}</span>
      )}
    </div>
  );
}

export function PanelSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section className="studio-section studio-panel-section" data-open={open}>
      <h3 className="studio-section-title studio-panel-section-title">
        <button
          type="button"
          className="studio-panel-section-toggle"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((current) => !current)}
        >
          <span>{title}</span>
          <span className="studio-panel-section-chevron" aria-hidden="true" />
        </button>
      </h3>
      {open && (
        <div id={contentId} className="studio-panel-section-body">
          {children}
        </div>
      )}
    </section>
  );
}

export function PanelSegmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<Option<T>>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="studio-seg studio-panel-segmented">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cx(
            "studio-seg-btn studio-panel-choice",
            value === option.value && "active is-active",
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function PanelChip({
  active = false,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
}) {
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      className={cx(
        "studio-chip studio-panel-choice",
        active && "active is-active",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function PanelSelect<T extends string | number>({
  value,
  options,
  onChange,
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange"> & {
  value: T;
  options: Array<Option<T>>;
  onChange: (value: T) => void;
}) {
  return (
    <select
      {...props}
      className={cx("studio-panel-select", props.className)}
      value={String(value)}
      onChange={(event) => {
        const option = options.find((item) => String(item.value) === event.target.value);
        if (option) onChange(option.value);
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={String(option.value)}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function PanelSwitch({
  checked,
  onChange,
  onLabel = "On",
  offLabel = "Off",
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  onLabel?: string;
  offLabel?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={cx("studio-panel-switch", checked && "is-on")}
      aria-pressed={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="studio-panel-switch-track" aria-hidden="true">
        <span className="studio-panel-switch-thumb" />
      </span>
      <span className="studio-panel-switch-label">
        {checked ? onLabel : offLabel}
      </span>
    </button>
  );
}

export function PanelButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      className={cx("studio-export-btn studio-panel-primary", className)}
    >
      {children}
    </button>
  );
}

export function PanelActionRow({ children }: { children: ReactNode }) {
  return <div className="studio-panel-actions">{children}</div>;
}
