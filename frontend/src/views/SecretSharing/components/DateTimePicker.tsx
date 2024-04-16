import { useEffect, useState } from "react";
import { cx } from "cva";

import { DatePicker, Input, Select, SelectItem } from "@app/components/v2";

export interface DateTimePickerProps {
  value?: Date;
  onValueChange?: (value?: Date) => void;
  onBlur?: () => void;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  defaultPreset?: string;
  className?: string;
}

const presets = {
  "15 minutes": 15 * 60 * 1000,
  "30 minutes": 30 * 60 * 1000,
  "1 hour": 60 * 60 * 1000,
  "8 hours": 8 * 60 * 60 * 1000,
  "1 day": 24 * 60 * 60 * 1000,
  "1 week": 7 * 24 * 60 * 60 * 1000
};

const presetKeys = Object.keys(presets);

export const DateTimePicker = ({
  value,
  onValueChange,
  onBlur,
  minDate,
  maxDate,
  disabled,
  defaultPreset,
  className
}: DateTimePickerProps) => {
  const [mode, setMode] = useState<"dropdown" | "calendar">("dropdown");
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const onPresetChange = (preset: string) => {
    if (preset === "custom") {
      setMode("calendar");
      return;
    }
    setMode("dropdown");
    if (!preset || !(preset in presets)) {
      return;
    }
    const time = presets[preset as keyof typeof presets];

    const newValue = new Date();
    newValue.setTime(newValue.getTime() + time);
    onValueChange?.(newValue);
    onBlur?.();
  };

  useEffect(() => {
    if (defaultPreset && defaultPreset in presets) {
      onPresetChange(defaultPreset);
    }
  }, [defaultPreset]);

  return (
    <div className={className}>
      <div
        className={cx(
          "flex items-center space-x-2",
          disabled ? "pointer-events-none opacity-50" : ""
        )}
      >
        <Select onValueChange={onPresetChange} defaultValue={defaultPreset}>
          {presetKeys.map((key) => (
            <SelectItem key={key} value={key}>
              {key}
            </SelectItem>
          ))}
          <SelectItem value="custom">Custom</SelectItem>
        </Select>
        {mode === "dropdown" ? null : (
          <div className="flex gap-2">
            <DatePicker
              value={value || undefined}
              onChange={(newValue) => {
                onValueChange?.(newValue);
              }}
              popUpProps={{
                open: datePickerOpen,
                onOpenChange: setDatePickerOpen
              }}
              fromDate={minDate}
              toDate={maxDate}
              onDayBlur={onBlur}
            />
            <Input
              type="time"
              value={value?.toLocaleTimeString()}
              onChange={(e) => {
                const newValue = new Date(value || new Date());
                const time = e.target.value.split(":");
                newValue.setHours(parseInt(time[0], 10));
                newValue.setMinutes(parseInt(time[1], 10));
                onValueChange?.(newValue);
              }}
              onBlur={onBlur}
            />
          </div>
        )}
      </div>
    </div>
  );
};
