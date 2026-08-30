import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiFetch } from "@/lib/apiFetch";
import { GlobalSearch } from "../GlobalSearch";

jest.mock("@/lib/apiFetch", () => ({
	apiFetch: jest.fn(),
}));

const mockedFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

function payload(overrides: Record<string, unknown[]> = {}) {
	return {
		data: {
			query: "beef",
			cuts: [{ cutCode: "BEEF_CHEEK", nameEn: "Beef Cheek", nameZh: "牛颊肉", primal: "Offal" }],
			commodities: [{ slug: "beef_carcass_us", name: "Beef", nameCn: "牛肉", category: "beef" }],
			news: [{ id: "n1", title: "Beef exports steady", source: "rss", publishedAt: "2026-08-30" }],
			...overrides,
		},
	};
}

describe("GlobalSearch", () => {
	beforeEach(() => {
		mockedFetch.mockClear();
	});

	it("fetches and renders grouped results after debounce", async () => {
		mockedFetch.mockResolvedValueOnce(payload());
		const user = userEvent.setup();
		render(<GlobalSearch />);

		await user.type(screen.getByLabelText("全局搜索"), "beef");

		await waitFor(() => expect(screen.getByText("牛颊肉")).toBeInTheDocument(), { timeout: 2000 });
		expect(screen.getByText("牛肉")).toBeInTheDocument();
		expect(screen.getByText("Beef exports steady")).toBeInTheDocument();
		expect(mockedFetch).toHaveBeenCalledWith("/api/search?q=beef");
	});

	it("shows the honest empty message when nothing matches", async () => {
		mockedFetch.mockResolvedValueOnce(payload({ cuts: [], commodities: [], news: [] }));
		const user = userEvent.setup();
		render(<GlobalSearch />);

		await user.type(screen.getByLabelText("全局搜索"), "zzz");

		await waitFor(
			() => expect(screen.getByText("无匹配结果（部位 / 商品 / 资讯）")).toBeInTheDocument(),
			{ timeout: 2000 },
		);
	});

	it("degrades to an explicit unavailable message on API failure (not fake emptiness)", async () => {
		mockedFetch.mockRejectedValueOnce(new Error("network"));
		const user = userEvent.setup();
		render(<GlobalSearch />);

		await user.type(screen.getByLabelText("全局搜索"), "beef");

		await waitFor(() => expect(screen.getByText("搜索暂不可用，稍后重试")).toBeInTheDocument(), {
			timeout: 2000,
		});
	});

	it("issues no request for an empty query", async () => {
		const user = userEvent.setup();
		render(<GlobalSearch />);
		await user.type(screen.getByLabelText("全局搜索"), " ");
		expect(mockedFetch).not.toHaveBeenCalled();
	});
});
