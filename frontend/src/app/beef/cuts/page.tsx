import { redirect } from "next/navigation";

/**
 * round-120: PRODUCT-SPEC §四 maps 牛副产品 (cut taxonomy) to /beef/cuts, but
 * the primal-grouped cut board lives on /beef — this index route never had a
 * page and 404'd while /beef/cuts/[cutCode] detail pages worked. Redirect to
 * the board instead of duplicating it.
 */
export default function BeefCutsIndexPage() {
	redirect("/beef");
}
