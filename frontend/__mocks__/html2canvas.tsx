/**
 * Manual mock for `html2canvas` — shared by the chart component test suites
 * (AnomalyChart, PredictionChart).
 *
 * The PNG-export path calls html2canvas(node).then(canvas => canvas.toDataURL()).
 * JSDOM has no real canvas rasterizer, so we resolve a fake canvas whose
 * toDataURL returns a fixed data URL. The export tests assert onExport was
 * invoked with "png"/"csv", not on the image bytes, so the fixed payload is
 * sufficient.
 *
 * Placement: `<rootDir>/__mocks__/html2canvas.ts` — Jest auto-loads this for
 * `jest.mock("html2canvas")` (no factory), removing the verbatim duplication
 * that existed in both chart test files.
 */

module.exports = {
	__esModule: true,
	default: jest.fn().mockResolvedValue({
		toDataURL: () => "data:image/png;base64,test",
	}),
};
