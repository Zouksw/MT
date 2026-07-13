"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { createRecord, useList } from "@/lib/api";
import { useIsMobile } from "@/lib/responsive-utils";
import { sanitizer } from "@/lib/sanitizer";

const CATEGORY_OPTIONS = [
	{ value: "MARKET_INSIGHT", label: "Market Insight" },
	{ value: "PRICE_MOVE", label: "Price Move" },
	{ value: "SUPPLY", label: "Supply" },
	{ value: "TRADE_POLICY", label: "Trade Policy" },
	{ value: "COMPANY", label: "Company" },
];

const STATUS_OPTIONS = [
	{ value: "published", label: "Published" },
	{ value: "draft", label: "Draft" },
];

interface FormState {
	title: string;
	summary: string;
	body: string;
	category: string;
	source: string;
	sourceUrl: string;
	commoditySlug: string;
	tags: string;
	status: string;
}

const INITIAL: FormState = {
	title: "",
	summary: "",
	body: "",
	category: "MARKET_INSIGHT",
	source: "",
	sourceUrl: "",
	commoditySlug: "",
	tags: "",
	status: "published",
};

export default function CreateNewsPage() {
	const router = useRouter();
	const toast = useToast();
	const isMobile = useIsMobile();
	const [form, setForm] = useState<FormState>(INITIAL);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [submitting, setSubmitting] = useState(false);

	// Commodities for the related-cut selector.
	const { data: commodities } = useList<{ slug: string; name: string; category: string }>(
		"market/commodities",
		{ pageSize: 1000 },
	);
	const beefCommodities = (commodities || []).filter((c) => c.category === "beef_cuts");
	const commodityOptions = [
		{ value: "", label: "— None —" },
		...beefCommodities.map((c) => ({ value: c.slug, label: c.name })),
	];

	const set = (field: keyof FormState, value: string) => {
		setForm((f) => ({ ...f, [field]: value }));
		if (errors[field]) setErrors((e) => ({ ...e, [field]: "" }));
	};

	const validate = (): boolean => {
		const e: Record<string, string> = {};
		if (!form.title.trim()) e.title = "Title is required";
		else if (form.title.length > 200) e.title = "Title must be 200 characters or fewer";
		if (!form.summary.trim()) e.summary = "Summary is required";
		if (!form.body.trim()) e.body = "Body is required";
		if (!form.source.trim()) e.source = "Source is required";
		if (form.sourceUrl && !/^https?:\/\//.test(form.sourceUrl))
			e.sourceUrl = "Must be a valid URL starting with http(s)://";
		setErrors(e);
		return Object.keys(e).length === 0;
	};

	const handleSubmit = async (ev: React.FormEvent) => {
		ev.preventDefault();
		if (!validate()) return;
		setSubmitting(true);
		try {
			// Sanitize free-text fields (XSS protection per the alerts/create pattern).
			const payload = {
				title: sanitizer.sanitizeString(form.title, 200),
				summary: sanitizer.sanitizeString(form.summary, 500),
				body: sanitizer.sanitizeString(form.body, 50000),
				category: form.category,
				source: sanitizer.sanitizeString(form.source, 100),
				sourceUrl: form.sourceUrl.trim() || null,
				commoditySlug: form.commoditySlug || null,
				tags: form.tags
					.split(",")
					.map((t) => sanitizer.sanitizeString(t.trim(), 50))
					.filter(Boolean),
				status: form.status,
			};
			await createRecord("news", payload);
			toast.showSuccess("Article published");
			setTimeout(() => router.push("/market-news"), 800);
		} catch (err) {
			toast.showError(err instanceof Error ? err.message : "Failed to create article");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<PageContainer>
			<PageHeader
				title="New Article"
				description="Publish a market dynamics article for the 资讯 feed"
				breadcrumbs={[
					{ label: "Home", href: "/" },
					{ label: "资讯", href: "/market-news" },
					{ label: "Market News", href: "/market-news" },
					{ label: "New" },
				]}
				actions={
					<Button variant="ghost" size="sm" onClick={() => router.push("/market-news")}>
						<ArrowLeft className="size-4 mr-1.5" />
						{!isMobile && "Back"}
					</Button>
				}
			/>

			<form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
				<Input
					label="Title"
					value={form.title}
					onChange={(e) => set("title", e.target.value)}
					error={errors.title}
					placeholder="e.g. Brazil beef exports hit record in Q1"
					fullWidth
					required
				/>

				<Input
					label="Summary"
					value={form.summary}
					onChange={(e) => set("summary", e.target.value)}
					error={errors.summary}
					placeholder="One-line summary shown in the feed"
					fullWidth
					required
				/>

				<Textarea
					label="Body"
					value={form.body}
					onChange={(e) => set("body", e.target.value)}
					error={errors.body}
					placeholder="Full article text (plain text, blank lines separate paragraphs)"
					rows={10}
					fullWidth
					required
				/>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
					<Select
						label="Category"
						options={CATEGORY_OPTIONS}
						value={form.category}
						onChange={(v) => set("category", v)}
						fullWidth
					/>
					<Select
						label="Status"
						options={STATUS_OPTIONS}
						value={form.status}
						onChange={(v) => set("status", v)}
						fullWidth
					/>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
					<Input
						label="Source"
						value={form.source}
						onChange={(e) => set("source", e.target.value)}
						error={errors.source}
						placeholder="e.g. Reuters, USDA, MLA"
						fullWidth
						required
					/>
					<Input
						label="Source URL (optional)"
						value={form.sourceUrl}
						onChange={(e) => set("sourceUrl", e.target.value)}
						error={errors.sourceUrl}
						placeholder="https://..."
						fullWidth
					/>
				</div>

				<Select
					label="Related beef cut (optional)"
					options={commodityOptions}
					value={form.commoditySlug}
					onChange={(v) => set("commoditySlug", v)}
					fullWidth
				/>

				<Input
					label="Tags (comma-separated, optional)"
					value={form.tags}
					onChange={(e) => set("tags", e.target.value)}
					placeholder="brazil, china, exports"
					fullWidth
				/>

				<div className="flex items-center gap-3 pt-2">
					<Button type="submit" variant="primary" size="lg" isLoading={submitting}>
						{submitting ? "Publishing…" : "Publish Article"}
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="lg"
						onClick={() => router.push("/market-news")}
					>
						Cancel
					</Button>
				</div>
			</form>
		</PageContainer>
	);
}
