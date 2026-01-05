'use client';

import { useState } from 'react';
import { PRESET_COLORS } from '../utils/categories';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [showHexInput, setShowHexInput] = useState(false);
  const [hexInput, setHexInput] = useState(value);

  const handlePresetColorClick = (color: string) => {
    onChange(color);
    setHexInput(color);
    setShowHexInput(false);
  };

  const handleHexInputChange = (hex: string) => {
    setHexInput(hex);
    // Validate hex color
    if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex)) {
      onChange(hex);
    }
  };

  const handleHexInputBlur = () => {
    // Ensure valid hex color
    if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hexInput)) {
      setHexInput(value);
    } else {
      onChange(hexInput);
    }
  };

  return (
    <div className="space-y-3">
      {/* Preset Colors Grid */}
      <div className="grid grid-cols-8 gap-2">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => handlePresetColorClick(color)}
            className={`w-8 h-8 rounded-full border-2 transition-all ${
              value === color
                ? 'border-black dark:border-white scale-110'
                : 'border-black/20 dark:border-white/20 hover:border-black/40 dark:hover:border-white/40'
            }`}
            style={{ backgroundColor: color }}
            aria-label={`Select color ${color}`}
          />
        ))}
      </div>

      {/* Hex Input Toggle */}
      <button
        type="button"
        onClick={() => {
          setShowHexInput(!showHexInput);
          setHexInput(value);
        }}
        className="w-full px-3 py-2 text-ios-caption-1 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white active:opacity-70 transition-colors"
      >
        {showHexInput ? 'Hide' : 'Custom Hex Color'}
      </button>

      {/* Hex Input */}
      {showHexInput && (
        <div>
          <input
            type="text"
            value={hexInput}
            onChange={(e) => handleHexInputChange(e.target.value)}
            onBlur={handleHexInputBlur}
            placeholder="#FF6B6B"
            className="w-full px-3 py-2 bg-white dark:bg-black text-ios-body text-black dark:text-white rounded-ios border border-black/20 dark:border-white/20 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
            maxLength={7}
          />
          <p className="mt-1 text-ios-caption-1 text-black/50 dark:text-white/50">
            Enter a hex color code (e.g., #FF6B6B)
          </p>
        </div>
      )}

      {/* Current Color Preview */}
      <div className="flex items-center gap-3 pt-2 border-t border-black/10 dark:border-white/10">
        <div
          className="w-10 h-10 rounded-full border border-black/20 dark:border-white/20"
          style={{ backgroundColor: value }}
        />
        <div>
          <p className="text-ios-caption-1 text-black/60 dark:text-white/60">Selected Color</p>
          <p className="text-ios-body font-mono text-black dark:text-white">{value.toUpperCase()}</p>
        </div>
      </div>
    </div>
  );
}

