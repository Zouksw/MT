"use client";

import useSWR from "swr";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function beefFetcher(url: string) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

function StatCard({ label, value, unit, trend }: { label: string; value: string; unit?: string; trend?: "up" | "down" | "flat" }) {
  const trendColor = trend === "up" ? "text-red-500" : trend === "down" ? "text-green-500" : "text-gray-400";
  const trendArrow = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
  return (
    <Card>
      <CardBody>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-semibold mt-1">
          {value}
          {unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
        </p>
        {trend && <p className={`text-xs mt-1 ${trendColor}`}>{trendArrow}</p>}
      </CardBody>
    </Card>
  );
}

export default function BeefOverview() {
  const { data: pricesData, error: pricesErr } = useSWR("/api/beef/prices/latest", beefFetcher);
  const { data: killData } = useSWR("/api/beef/weekly-kill?weeks=4", beefFetcher);
  const { data: storageData } = useSWR("/api/beef/cold-storage?months=3", beefFetcher);
  const { data: cutsData } = useSWR("/api/beef/cuts", beefFetcher);

  const latestPrices = pricesData?.data?.prices ?? pricesData?.prices ?? [];
  const weeklyKills = killData?.data?.kills ?? killData?.kills ?? [];
  const coldStorage = storageData?.data?.coldStorage ?? storageData?.coldStorage ?? [];
  const cuts = cutsData?.data?.cuts ?? cutsData?.cuts ?? [];

  // Group cuts by primal
  const primalGroups: Record<string, typeof cuts> = {};
  for (const cut of cuts) {
    const key = cut.primal || "Other";
    if (!primalGroups[key]) primalGroups[key] = [];
    primalGroups[key].push(cut);
  }

  // Compute summary stats
  const avgPrice = latestPrices.length > 0
    ? (latestPrices.reduce((s: number, p: { price: number }) => s + p.price, 0) / latestPrices.length).toFixed(2)
    : "--";
  const totalKills = weeklyKills.reduce((s: number, k: { headCount: number }) => s + k.headCount, 0);
  const usStorage = coldStorage.find((s: { country: string }) => s.country === "US");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 lg:p-6">
      <div className="mx-auto max-w-[1440px]">
        <PageHeader
          title="Beef Market Intelligence"
          description="Factory-level and cut-level beef trading data across global markets"
        />

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Avg Cut Price" value={avgPrice} unit="USD/kg" />
          <StatCard label="Tracked Cuts" value={String(cuts.length)} />
          <StatCard label="Weekly Slaughter" value={totalKills > 0 ? totalKills.toLocaleString() : "--"} unit="head" />
          <StatCard label="US Cold Storage" value={usStorage ? String(usStorage.totalLbs) : "--"} unit="M lbs" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Latest Prices by Cut */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Latest Cut Prices</CardTitle>
            </CardHeader>
            <CardBody>
              {pricesErr && <p className="text-sm text-gray-400">Unable to load prices</p>}
              {latestPrices.length === 0 && !pricesErr && (
                <p className="text-sm text-gray-400">No price data available. Run scrapers to populate.</p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 font-medium text-gray-500">Cut</th>
                      <th className="text-right py-2 font-medium text-gray-500">Price (USD/kg)</th>
                      <th className="text-left py-2 font-medium text-gray-500">Source</th>
                      <th className="text-left py-2 font-medium text-gray-500">Factory</th>
                      <th className="text-left py-2 font-medium text-gray-500">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestPrices.slice(0, 20).map((p: { cutCode: string; price: number; source: string; grade?: string; factory?: { code: string; name: string; country: string } }, i: number) => (
                      <tr key={`${p.cutCode}-${i}`} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900">
                        <td className="py-2">
                          <a href={`/beef/cuts/${p.cutCode}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                            {p.cutCode.replace(/_/g, " ")}
                          </a>
                        </td>
                        <td className="text-right py-2 font-mono">{p.price.toFixed(2)}</td>
                        <td className="py-2 text-gray-500 text-xs">{p.source}</td>
                        <td className="py-2 text-xs">{p.factory ? `${p.factory.name} (${p.factory.country})` : "--"}</td>
                        <td className="py-2 text-xs text-gray-500">{p.grade || "--"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          {/* Cut Taxonomy by Primal */}
          <Card>
            <CardHeader>
              <CardTitle>Cut Categories</CardTitle>
            </CardHeader>
            <CardBody>
              {Object.entries(primalGroups).map(([primal, primalCuts]) => (
                <div key={primal} className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{primal}</h3>
                  <div className="flex flex-wrap gap-1">
                    {primalCuts.map((cut: { cutCode: string; nameZh?: string; nameEn: string }) => (
                      <a
                        key={cut.cutCode}
                        href={`/beef/cuts/${cut.cutCode}`}
                        className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        {cut.nameZh || cut.nameEn}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Weekly Kill Data */}
          <Card>
            <CardHeader>
              <CardTitle>Weekly Slaughter by Country</CardTitle>
            </CardHeader>
            <CardBody>
              {weeklyKills.length === 0 ? (
                <p className="text-sm text-gray-400">No kill data available</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 font-medium text-gray-500">Week</th>
                        <th className="text-left py-2 font-medium text-gray-500">Country</th>
                        <th className="text-right py-2 font-medium text-gray-500">Head Count</th>
                        <th className="text-right py-2 font-medium text-gray-500">Avg Weight (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weeklyKills.map((k: { weekEnding: string; country: string; headCount: number; avgWeight?: number }, i: number) => (
                        <tr key={`${k.country}-${i}`} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-1.5 text-xs text-gray-500">{new Date(k.weekEnding).toLocaleDateString()}</td>
                          <td className="py-1.5">{k.country}</td>
                          <td className="text-right py-1.5 font-mono">{k.headCount.toLocaleString()}</td>
                          <td className="text-right py-1.5 font-mono text-gray-500">{k.avgWeight?.toFixed(0) || "--"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Cold Storage */}
          <Card>
            <CardHeader>
              <CardTitle>Cold Storage Stocks</CardTitle>
            </CardHeader>
            <CardBody>
              {coldStorage.length === 0 ? (
                <p className="text-sm text-gray-400">No cold storage data available</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 font-medium text-gray-500">Date</th>
                        <th className="text-left py-2 font-medium text-gray-500">Country</th>
                        <th className="text-right py-2 font-medium text-gray-500">Total (M lbs)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coldStorage.map((s: { date: string; country: string; totalLbs: number }, i: number) => (
                        <tr key={`${s.country}-${i}`} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-1.5 text-xs text-gray-500">{new Date(s.date).toLocaleDateString()}</td>
                          <td className="py-1.5">{s.country}</td>
                          <td className="text-right py-1.5 font-mono">{s.totalLbs.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
