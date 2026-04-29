"use client";

import { Globe, Factory, Award, Tag as TagIcon, Package, Database } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tag } from "@/components/ui/Tag";
import FreshnessBadge from "./FreshnessBadge";

interface CommodityInfoCardProps {
  commodity: {
    id: string;
    slug: string;
    name: string;
    nameCn?: string;
    category: string;
    subcategory?: string;
    grade?: string;
    originCountry?: string;
    factoryCode?: string;
    unit: string;
    currency: string;
  };
  latestDate?: string | null;
  latestSource?: string | null;
}

const COUNTRY_NAMES: Record<string, string> = {
  CN: "China",
  AUS: "Australia",
  BRA: "Brazil",
  ARG: "Argentina",
  URY: "Uruguay",
  USA: "United States",
  NZ: "New Zealand",
  MY: "Malaysia",
};

const CATEGORY_LABELS: Record<string, string> = {
  beef_cuts: "Beef Cuts",
  live_cattle: "Live Cattle",
  futures: "Futures",
  grain: "Grain",
  feed: "Feed",
  forex: "Exchange Rate",
  shipping: "Shipping",
  energy: "Energy",
  metals: "Metals",
  soft_commodities: "Soft Commodities",
  meat_dairy: "Meat & Dairy",
  fertilizer: "Fertilizer",
  index: "Index",
  indices: "Indices",
  other_meat: "Other Meat",
};

export default function CommodityInfoCard({
  commodity,
  latestDate,
  latestSource,
}: CommodityInfoCardProps) {
  const tags: Array<{ label: string; color: "info" | "success" | "warning" | "default" }> = [];

  if (commodity.originCountry) {
    tags.push({
      label: COUNTRY_NAMES[commodity.originCountry] || commodity.originCountry,
      color: "info",
    });
  }
  if (commodity.grade) {
    tags.push({ label: `Grade ${commodity.grade}`, color: "success" });
  }
  if (commodity.subcategory) {
    tags.push({ label: commodity.subcategory.replace(/_/g, " "), color: "default" });
  }
  tags.push({
    label: CATEGORY_LABELS[commodity.category] || commodity.category,
    color: "default",
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="size-4" />
            <span>{commodity.name}</span>
          </CardTitle>
          <FreshnessBadge date={latestDate ?? null} compact />
        </div>
        {commodity.nameCn && (
          <p className="text-sm text-muted-foreground -mt-1">{commodity.nameCn}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Tags */}
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <Tag key={t.label} color={t.color}>{t.label}</Tag>
            ))}
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <TagIcon className="size-3" />
              <span>{commodity.unit}</span>
            </div>
            {commodity.originCountry && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Globe className="size-3" />
                <span>{COUNTRY_NAMES[commodity.originCountry] || commodity.originCountry}</span>
              </div>
            )}
            {commodity.factoryCode && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Factory className="size-3" />
                <span>Plant #{commodity.factoryCode}</span>
              </div>
            )}
            {commodity.grade && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Award className="size-3" />
                <span>{commodity.grade}</span>
              </div>
            )}
            {latestSource && (
              <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                <Database className="size-3" />
                <span>{latestSource}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
