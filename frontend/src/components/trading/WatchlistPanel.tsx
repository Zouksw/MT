"use client";

import React from "react";
import { Card, Empty, Spin, Button, Tooltip } from "antd";
import { StarOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { useWatchlists } from "@/lib/watchlist";
import Link from "next/link";

export default function WatchlistPanel() {
  const { watchlists, loading, mutate } = useWatchlists();

  const handleCreate = async () => {
    const name = prompt("Watchlist name:");
    if (!name) return;

    const token = (await import("@/lib/tokenManager")).tokenManager.getToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    await fetch(`${base}/api/watchlists`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name }),
    });
    mutate();
  };

  if (loading) {
    return (
      <Card>
        <Spin />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {watchlists.map((wl) => (
        <Card
          key={wl.id}
          title={
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <StarOutlined className="text-yellow-500" />
                {wl.name}
                <span className="text-xs text-gray-400">({wl.itemCount})</span>
              </span>
              {!wl.isDefault && (
                <Tooltip title="Delete watchlist">
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={async () => {
                      const token = (await import("@/lib/tokenManager")).tokenManager.getToken();
                      const headers: Record<string, string> = {};
                      if (token) headers["Authorization"] = `Bearer ${token}`;
                      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                      await fetch(`${base}/api/watchlists/${wl.id}`, { method: "DELETE", headers });
                      mutate();
                    }}
                  />
                </Tooltip>
              )}
            </div>
          }
          size="small"
        >
          {wl.items.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span className="text-xs text-gray-400">
                  No items.{" "}
                  <Link href="/trading" className="text-blue-500">
                    Browse commodities
                  </Link>
                </span>
              }
            />
          ) : (
            <div className="divide-y">
              {wl.items.map((item) => (
                <Link
                  key={item.id}
                  href={`/trading?slug=${item.commodity.slug}`}
                  className="flex items-center justify-between py-2 hover:bg-gray-50 px-1 rounded transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium">
                      {item.commodity.nameCn || item.commodity.name}
                    </div>
                    <div className="text-xs text-gray-400">{item.commodity.slug}</div>
                  </div>
                  <div className="text-right">
                    {item.latestPrice != null ? (
                      <div className="text-sm font-mono">
                        {Number(item.latestPrice).toFixed(2)}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400">--</div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      ))}

      <Button
        type="dashed"
        block
        icon={<PlusOutlined />}
        onClick={handleCreate}
      >
        New Watchlist
      </Button>
    </div>
  );
}
