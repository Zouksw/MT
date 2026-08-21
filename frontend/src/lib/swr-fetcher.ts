/**
 * SWR fetcher — thin delegate over the single API client (round-115, TD-8).
 * The contract is unchanged: takes an "/api/..." path, throws on non-2xx
 * (SWR error binding), returns parsed JSON. The historical `Promise<any>`
 * return type is preserved so SWR's generic inference at the ~20 call sites
 * (typed via useSWR<T>) keeps working — apiFetch additionally attaches the
 * Bearer header when a token exists and clears it on 401.
 */
import { apiFetch } from "./apiFetch";

export async function swrFetcher(url: string): Promise<any> {
	return apiFetch(url);
}
