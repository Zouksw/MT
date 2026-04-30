"use client";

import useSWR from "swr";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface BeefCut {
  cutCode: string;
  nameEn: string;
  nameZh?: string;
  primal?: string;
}

interface BeefCutSelectorProps {
  selected: string;
  onSelect: (cutCode: string) => void;
}

export default function BeefCutSelector({ selected, onSelect }: BeefCutSelectorProps) {
  const { data, error } = useSWR(`${API_BASE}/api/beef/cuts`, async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  });

  const cuts: BeefCut[] = data?.data?.cuts ?? [];

  if (error || cuts.length === 0) return null;

  // Group by primal
  const groups: Record<string, BeefCut[]> = {};
  for (const cut of cuts) {
    const key = cut.primal || "Other";
    if (!groups[key]) groups[key] = [];
    groups[key].push(cut);
  }

  return (
    <div className="mb-4">
      <div className="flex flex-wrap gap-1">
        {Object.entries(groups).map(([primal, primalCuts]) => (
          <div key={primal} className="flex items-center gap-1 mr-3 mb-1">
            <span className="text-xs font-medium text-gray-400 mr-1">{primal}:</span>
            {primalCuts.map((cut) => (
              <button
                key={cut.cutCode}
                type="button"
                onClick={() => onSelect(cut.cutCode)}
                className={`px-2 py-0.5 rounded text-xs transition-colors ${
                  selected === cut.cutCode
                    ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-medium"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
                title={cut.nameEn}
              >
                {cut.nameZh || cut.nameEn}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
