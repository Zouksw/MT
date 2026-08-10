import { render } from "@testing-library/react";
import type { BeefFreshness } from "../BeefFreshnessBadge";
import BeefFreshnessBadge from "../BeefFreshnessBadge";

// REGRESSION (round-92): TIER_CONFIG[freshness] was dereferenced without a
// fallback. A truthy-but-unknown freshness value (e.g. backend casing drift
// "STALE", a future tier, or a malformed payload) made cfg undefined and threw
// TypeError at render — crashing every row of the beef price table. Mirrors the
// round-86 CutForecastCell direction guard.

describe("BeefFreshnessBadge", () => {
	it("renders the 'no data' placeholder when freshness is absent", () => {
		const { container } = render(<BeefFreshnessBadge freshness={undefined} />);
		expect(container.textContent).toContain("—");
	});

	it("renders the label for a valid 'live' tier", () => {
		const { container } = render(<BeefFreshnessBadge freshness="live" />);
		expect(container.textContent).toContain("Live");
	});

	it("does not crash on an unknown tier (falls back to snapshot)", () => {
		// Cast through unknown to simulate a malformed API payload — the badge
		// must render something (no exception) rather than crash the table.
		const malformed = "STALE" as unknown as BeefFreshness;
		const { container } = render(<BeefFreshnessBadge freshness={malformed} />);
		expect(container.firstChild).not.toBeNull();
		// Snapshot is the safe fallback tier for unknown data states.
		expect(container.textContent).toContain("Snapshot");
	});
});
