"use client";

import { FileBarChart, Plus, Zap } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Table } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { useSimAccount, useSimAccounts } from "@/lib/simulation";

export default function SimulationPage() {
	const { accounts, loading, mutate } = useSimAccounts();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [createOpen, setCreateOpen] = useState(false);
	const toast = useToast();

	const handleCreate = async (name: string) => {
		const token = (await import("@/lib/tokenManager")).tokenManager.getToken();
		const headers: Record<string, string> = { "Content-Type": "application/json" };
		if (token) headers.Authorization = `Bearer ${token}`;

		const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
		const res = await fetch(`${base}/api/sim/accounts`, {
			method: "POST",
			headers,
			body: JSON.stringify({ name, initialBalance: 0 }),
		});

		if (res.ok) {
			toast.showSuccess("Account created");
			setCreateOpen(false);
			mutate();
		} else {
			toast.showError("Failed to create account");
		}
	};

	return (
		<PageContainer>
			<PageHeader
				title="Prediction Backtest"
				description="Verify AI prediction accuracy against historical price movements"
				actions={
					<Button onClick={() => setCreateOpen(true)} icon={<Plus className="size-4" />}>
						New Backtest
					</Button>
				}
			/>

			{loading ? (
				<div className="flex items-center justify-center py-12">
					<div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
				</div>
			) : accounts.length === 0 ? (
				<Card>
					<CardBody>
						<div className="text-center py-8">
							<FileBarChart className="size-12 mx-auto text-gray-300 mb-3" />
							<p className="text-gray-500 mb-4">
								No backtest accounts yet. Create one to start verifying predictions!
							</p>
							<Button onClick={() => setCreateOpen(true)}>Create Backtest</Button>
						</div>
					</CardBody>
				</Card>
			) : (
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
					{/* Account cards */}
					<div className="space-y-3">
						{accounts.map((a) => (
							<Card
								key={a.id}
								hover
								className={selectedId === a.id ? "ring-2 ring-primary" : ""}
								onClick={() => setSelectedId(a.id)}
							>
								<CardBody>
									<div className="font-medium mb-2">{a.name}</div>
									<div className="grid grid-cols-2 gap-2">
										<div>
											<p className="text-xs text-gray-500">Predictions</p>
											<p className="text-sm font-mono" style={{ fontSize: 14 }}>
												{a.tradeCount}
											</p>
										</div>
										<div>
											<p className="text-xs text-gray-500">Score</p>
											<p
												className="text-sm font-mono"
												style={{ fontSize: 14, color: a.pnl >= 0 ? "#16A34A" : "#DC2626" }}
											>
												{a.pnl >= 0 ? "↑" : "↓"}
												{a.pnl.toFixed(2)}
											</p>
										</div>
									</div>
									<div className="mt-2 text-xs text-gray-400">
										{a.tradeCount} predictions · {a.orderCount} entries
									</div>
								</CardBody>
							</Card>
						))}
					</div>

					{/* Account detail */}
					<div className="lg:col-span-2">
						{selectedId ? (
							<AccountDetail accountId={selectedId} />
						) : (
							<Card>
								<CardBody>
									<div className="text-center py-8">
										<p className="text-gray-500">Select an account</p>
									</div>
								</CardBody>
							</Card>
						)}
					</div>
				</div>
			)}

			<CreateAccountModal
				open={createOpen}
				onClose={() => setCreateOpen(false)}
				onSubmit={handleCreate}
			/>
		</PageContainer>
	);
}

function CreateAccountModal({
	open,
	onClose,
	onSubmit,
}: {
	open: boolean;
	onClose: () => void;
	onSubmit: (name: string) => void;
}) {
	const [name, setName] = useState("");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (name.trim()) {
			onSubmit(name.trim());
			setName("");
		}
	};

	return (
		<Modal open={open} onClose={onClose} title="Create Backtest Account">
			<form onSubmit={handleSubmit} className="space-y-4">
				<Input
					label="Account Name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="My Backtest"
					fullWidth
					required
				/>
				<Button type="submit" fullWidth>
					Create
				</Button>
			</form>
		</Modal>
	);
}

interface TradeRecord {
	id: string;
	commodity: { name: string };
	side: string;
	quantity: number;
	entryPrice: number;
	realizedPnl: number | null;
}

function AccountDetail({ accountId }: { accountId: string }) {
	const { account, loading } = useSimAccount(accountId);
	const [orderModalOpen, setOrderModalOpen] = useState(false);
	const _toast = useToast();

	if (loading || !account) {
		return (
			<div className="flex items-center justify-center py-12">
				<div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
			</div>
		);
	}

	const tradeColumns = [
		{
			key: "commodity",
			title: "Commodity",
			render: (_v: unknown, record: TradeRecord) => record.commodity.name,
		},
		{
			key: "side",
			title: "Side",
			render: (_v: unknown, record: TradeRecord) => (
				<Tag color={record.side === "BUY" ? "success" : "error"}>{record.side}</Tag>
			),
		},
		{
			key: "quantity",
			title: "Qty",
			render: (_v: unknown, record: TradeRecord) => record.quantity.toFixed(2),
		},
		{
			key: "entry",
			title: "Entry",
			render: (_v: unknown, record: TradeRecord) => record.entryPrice.toFixed(2),
		},
		{
			key: "pnl",
			title: "Result",
			render: (_v: unknown, record: TradeRecord) =>
				record.realizedPnl != null ? (
					<Tag color={record.realizedPnl >= 0 ? "success" : "error"}>
						{record.realizedPnl >= 0 ? "Correct" : "Incorrect"}
					</Tag>
				) : (
					<Tag color="info">Pending</Tag>
				),
		},
	];

	return (
		<div className="space-y-4">
			<Card>
				<CardBody>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
						<div>
							<p className="text-xs text-gray-500">Predictions</p>
							<p className="text-lg font-semibold font-mono">
								{account.openTradeCount + account.pendingOrderCount}
							</p>
						</div>
						<div>
							<p className="text-xs text-gray-500">Score</p>
							<p
								className="text-lg font-semibold font-mono"
								style={{ color: account.totalPnl >= 0 ? "#16A34A" : "#DC2626" }}
							>
								{account.totalPnl.toFixed(2)}
							</p>
						</div>
						<div>
							<p className="text-xs text-gray-500">Open Predictions</p>
							<p className="text-lg font-semibold font-mono">{account.openTradeCount}</p>
						</div>
						<div className="flex flex-col items-end gap-1">
							<Button size="sm" onClick={() => setOrderModalOpen(true)}>
								<span className="flex items-center gap-1">
									<Zap className="size-3.5" />
									Enter Prediction
								</span>
							</Button>
							<span className="text-xs text-gray-400">{account.pendingOrderCount} pending</span>
						</div>
					</div>
				</CardBody>
			</Card>

			<Card>
				<Card>
					<CardBody>
						<h3 className="font-semibold mb-3">Recent Predictions</h3>
						{account.recentTrades.length === 0 ? (
							<div className="text-center py-6">
								<p className="text-gray-500 text-sm">No predictions yet</p>
							</div>
						) : (
							<Table
								dataSource={account.recentTrades}
								columns={tradeColumns}
								rowKey="id"
								emptyText="No predictions yet"
							/>
						)}
					</CardBody>
				</Card>
			</Card>

			<OrderModal
				accountId={accountId}
				open={orderModalOpen}
				onClose={() => setOrderModalOpen(false)}
			/>
		</div>
	);
}

function OrderModal({
	accountId,
	open,
	onClose,
}: {
	accountId: string;
	open: boolean;
	onClose: () => void;
}) {
	const [commodityId, setCommodityId] = useState("");
	const [side, setSide] = useState("");
	const [quantity, setQuantity] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const toast = useToast();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!commodityId || !side || !quantity) return;

		setSubmitting(true);
		try {
			const token = (await import("@/lib/tokenManager")).tokenManager.getToken();
			const headers: Record<string, string> = { "Content-Type": "application/json" };
			if (token) headers.Authorization = `Bearer ${token}`;

			const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
			const res = await fetch(`${base}/api/sim/accounts/${accountId}/orders`, {
				method: "POST",
				headers,
				body: JSON.stringify({ commodityId, side, type: "MARKET", quantity: parseFloat(quantity) }),
			});

			if (res.ok) {
				toast.showSuccess("Prediction entered");
				onClose();
				setCommodityId("");
				setSide("");
				setQuantity("");
			} else {
				const data = await res.json();
				toast.showError(data.error?.message || "Failed to enter prediction");
			}
		} catch {
			toast.showError("Network error");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Modal open={open} onClose={onClose} title="New Prediction">
			<form onSubmit={handleSubmit} className="space-y-4">
				<Input
					label="Commodity"
					value={commodityId}
					onChange={(e) => setCommodityId(e.target.value)}
					fullWidth
					required
				/>
				<Select
					label="Direction"
					value={side}
					onChange={setSide}
					options={[
						{ value: "BUY", label: "Predict Up" },
						{ value: "SELL", label: "Predict Down" },
					]}
					fullWidth
				/>
				<Input
					label="Quantity"
					type="number"
					value={quantity}
					onChange={(e) => setQuantity(e.target.value)}
					fullWidth
					required
				/>
				<Button type="submit" isLoading={submitting} fullWidth>
					Enter Prediction
				</Button>
			</form>
		</Modal>
	);
}
