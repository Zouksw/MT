"use client";

import { useParams } from "next/navigation";
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

export default function CutDetail() {
  const params = useParams();
  const cutCode = params.cutCode as string;

  const { data: cutData } = useSWR(cutCode ? `/api/beef/cuts/${cutCode}` : null, beefFetcher);
  const { data: priceData, error: priceErr } = useSWR(
    cutCode ? `/api/beef/prices/history/${cutCode}?days=90` : null,
    beefFetcher,
  );

  const cut = cutData?.data ?? cutData;
  const prices = priceData?.data?.prices ?? priceData?.prices ?? [];

  const displayName = cut?.nameZh ? `${cut.nameZh} (${cut.nameEn})` : cut?.nameEn || cutCode.replace(/_/g, " ");

  // Group prices by source for mini chart display
  const bySource: Record<string, typeof prices> = {};
  for (const p of prices) {
    const key = `${p.source} (${p.factory?.country || "?"})`;
    if (!bySource[key]) bySource[key] = [];
    bySource[key].push(p);
  }

  // Compute price range
  const allPrices = prices.map((p: { price: number }) => p.price);
  const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
  const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 0;
  const latestPrice = allPrices.length > 0 ? allPrices[allPrices.length - 1] : 0;

  return (
    <PageContainer>
        <PageHeader
          title={displayName}
          description={cut?.primal ? `Primal: ${cut.primal}` : cutCode}
        />

        {/* Cut Info */}
        {cut && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardBody>
                <p className="text-xs text-gray-500">English</p>
                <p className="font-medium mt-1">{cut.nameEn || "--"}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-xs text-gray-500">Chinese</p>
                <p className="font-medium mt-1">{cut.nameZh || "--"}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-xs text-gray-500">Price Range (90d)</p>
                <p className="font-medium mt-1">{minPrice.toFixed(2)} — {maxPrice.toFixed(2)} <span className="text-xs text-gray-400">USD/kg</span></p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-xs text-gray-500">Latest Price</p>
                <p className="text-2xl font-semibold mt-1">{latestPrice.toFixed(2)} <span className="text-sm font-normal text-gray-400">USD/kg</span></p>
              </CardBody>
            </Card>
          </div>
        )}

        {/* IMPS / HS Code info */}
        {cut && (cut.impsCode || cut.hsCode) && (
          <div className="flex gap-3 mb-4">
            {cut.impsCode && (
              <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">IMPS: {cut.impsCode}</span>
            )}
            {cut.hsCode && (
              <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">HS: {cut.hsCode}</span>
            )}
            {cut.subprimal && (
              <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">Subprimal: {cut.subprimal}</span>
            )}
          </div>
        )}

        {/* Price History by Source */}
        {priceErr && <p className="text-sm text-red-500 mb-4">Failed to load price history</p>}

        {Object.entries(bySource).map(([source, sourcePrices]) => {
          const spMin = Math.min(...sourcePrices.map((p: { price: number }) => p.price));
          const spMax = Math.max(...sourcePrices.map((p: { price: number }) => p.price));
          const range = spMax - spMin || 1;

          return (
            <Card key={source} className="mb-4">
              <CardHeader>
                <CardTitle className="text-sm">{source}</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="text-left">Date</th>
                        <th className="text-left">Factory</th>
                        <th className="text-right">Price</th>
                        <th className="text-left">Grade</th>
                        <th className="w-32">Range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sourcePrices.slice(-30).map((p: { date: string; price: number; grade?: string; factory?: { code: string; name: string; country: string } }, i: number) => {
                        const pct = ((p.price - spMin) / range) * 100;
                        return (
                          <tr key={`${p.date}-${p.factory?.code}-${i}`}>
                            <td className="text-xs text-gray-500">{new Date(p.date).toLocaleDateString()}</td>
                            <td className="text-xs">{p.factory ? `${p.factory.name}` : "--"}</td>
                            <td className="text-right font-mono">{p.price.toFixed(2)}</td>
                            <td className="text-xs text-gray-500">{p.grade || "--"}</td>
                            <td>
                              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                                <div
                                  className="bg-blue-500 h-1.5 rounded-full"
                                  style={{ width: `${Math.max(pct, 3)}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          );
        })}

        {prices.length === 0 && !priceErr && (
          <p className="text-sm text-gray-400">No price history available for this cut.</p>
        )}
    </PageContainer>
  );
}
