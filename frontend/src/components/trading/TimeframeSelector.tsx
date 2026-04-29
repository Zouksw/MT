"use client";


export type Timeframe = "daily" | "weekly" | "monthly";

interface TimeframeSelectorProps {
  value: Timeframe;
  onChange: (tf: Timeframe) => void;
}

const options: { key: Timeframe; labelCn: string; labelEn: string }[] = [
  { key: "daily", labelCn: "日", labelEn: "Daily" },
  { key: "weekly", labelCn: "周", labelEn: "Weekly" },
  { key: "monthly", labelCn: "月", labelEn: "Monthly" },
];

export default function TimeframeSelector({
  value,
  onChange,
}: TimeframeSelectorProps) {
  return (
    <fieldset
      className="inline-flex rounded-md overflow-hidden"
      style={{ boxShadow: "rgba(0,0,0,0.08) 0px 0px 0px 1px" }}
      aria-label="Timeframe selector"
    >
      {options.map((opt) => {
        const isActive = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={`
              px-4 py-1.5 text-xs font-medium transition-colors
              focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
              ${
                isActive
                  ? "bg-[#171717] text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }
            `}
            aria-pressed={isActive}
          >
            <span className="block text-sm leading-tight">{opt.labelCn}</span>
            <span
              className={`block text-[10px] leading-tight ${
                isActive ? "text-gray-300" : "text-gray-400"
              }`}
            >
              {opt.labelEn}
            </span>
          </button>
        );
      })}
    </fieldset>
  );
}
