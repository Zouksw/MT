"use client";

import useSWR from "swr";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function beefFetcher(url: string) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

const COUNTRY_FLAGS: Record<string, string> = {
  AU: "🇦🇺", BR: "🇧🇷", AR: "🇦🇷", UY: "🇺🇾", US: "🇺🇸",
};

const COUNTRY_NAMES: Record<string, string> = {
  AU: "Australia", BR: "Brazil", AR: "Argentina", UY: "Uruguay", US: "United States",
};

export default function FactoryDirectory() {
  const { data, error } = useSWR("/api/beef/factories", beefFetcher);

  const factories = data?.data?.factories ?? data?.factories ?? [];

  // Group by country
  const byCountry: Record<string, typeof factories> = {};
  for (const f of factories) {
    if (!byCountry[f.country]) byCountry[f.country] = [];
    byCountry[f.country].push(f);
  }

  return (
    <PageContainer>
        <PageHeader
          title="Factory Directory"
          description="Accredited beef processing plants by country"
        />

        {error && <p className="text-sm text-red-500 mb-4">Failed to load factory data</p>}

        {Object.entries(byCountry).map(([country, countryFactories]) => (
          <div key={country} className="mb-6">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <span>{COUNTRY_FLAGS[country] || ""}</span>
              <span>{COUNTRY_NAMES[country] || country}</span>
              <span className="text-sm font-normal text-gray-400">({countryFactories.length} plants)</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {countryFactories.map((f: { code: string; name: string; region?: string; capacity?: number; accredited: string[]; active: boolean }) => (
                <Card key={f.code}>
                  <CardBody>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium">{f.name}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Code: {f.code} {f.region ? `· ${f.region}` : ""}
                        </p>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${f.active ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-gray-100 dark:bg-gray-800 text-gray-500"}`}>
                        {f.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {f.capacity && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        Capacity: {f.capacity.toLocaleString()} head/week
                      </p>
                    )}
                    <div className="mt-2">
                      <span className="text-xs text-gray-500 mr-1">Markets:</span>
                      {f.accredited.map((m: string) => (
                        <span key={m} className="inline-block text-xs px-1.5 py-0.5 mr-1 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                          {m}
                        </span>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        ))}

        {factories.length === 0 && !error && (
          <p className="text-sm text-gray-400">No factory data available. Run seed to populate.</p>
        )}
    </PageContainer>
  );
}
