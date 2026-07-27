import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CSVDropzone } from "../CSVDropzone";

function makeFile(name: string, content: string, type = "text/csv") {
	const blob = new Blob([content], { type });
	return new File([blob], name, { type });
}

/** Build a CSV file whose byte size exceeds `minBytes` by padding with rows. */
function makeOversizedFile(name: string, minBytes: number) {
	// Each row adds ~30 bytes; pad until we clear the threshold.
	let content = "factoryCode,cutCode,price,date\n";
	while (content.length < minBytes) {
		content += "AU-847,BRISKET_NAVEL,8.45,2026-07-25\n";
	}
	return makeFile(name, content);
}

describe("CSVDropzone", () => {
	it("renders the drop prompt initially", () => {
		render(<CSVDropzone onFileSelected={jest.fn()} />);
		expect(screen.getByText("Drop CSV here, or click to browse")).toBeInTheDocument();
	});

	it("accepts a valid CSV via the file input and shows the filename", async () => {
		const user = userEvent.setup();
		const onFile = jest.fn();
		render(<CSVDropzone onFileSelected={onFile} />);

		const input = document.querySelector('input[type="file"]') as HTMLInputElement;
		const file = makeFile("prices.csv", "factoryCode,cutCode,price,date\n");
		await user.upload(input, file);

		expect(screen.getByText("prices.csv")).toBeInTheDocument();
		expect(onFile).toHaveBeenCalledWith(file);
	});

	it("rejects a non-CSV file with an error message", async () => {
		const onFile = jest.fn();
		render(<CSVDropzone onFileSelected={onFile} />);

		const input = document.querySelector('input[type="file"]') as HTMLInputElement;
		// userEvent.upload respects the input's `accept` attr and silently drops
		// .txt — so we bypass it with a direct change event to exercise the
		// component's own validation (the real defense).
		const file = makeFile("notes.txt", "hello world", "text/plain");
		fireEvent.change(input, { target: { files: [file] } });

		expect(screen.getByText("File must be a .csv")).toBeInTheDocument();
		expect(onFile).toHaveBeenCalledWith(null);
	});

	it("rejects an oversized file", async () => {
		const user = userEvent.setup();
		const onFile = jest.fn();
		render(<CSVDropzone onFileSelected={onFile} maxSizeBytes={100} />);

		const input = document.querySelector('input[type="file"]') as HTMLInputElement;
		// Build a file larger than the 100-byte limit by padding real content.
		await user.upload(input, makeOversizedFile("big.csv", 500));

		expect(screen.getByText(/max is/)).toBeInTheDocument();
		expect(onFile).toHaveBeenCalledWith(null);
	});

	it("accepts a dropped file", () => {
		const onFile = jest.fn();
		render(<CSVDropzone onFileSelected={onFile} />);

		const dropzone = screen.getByRole("button");
		const file = makeFile("dropped.csv", "factoryCode,cutCode,price,date\n");
		// jsdom doesn't implement DataTransfer fully; construct minimally.
		const dt = {
			files: [file],
		};
		fireEvent.drop(dropzone, { dataTransfer: dt });

		expect(screen.getByText("dropped.csv")).toBeInTheDocument();
		expect(onFile).toHaveBeenCalledWith(file);
	});

	it("clears the selection when 'Choose a different file' is clicked", async () => {
		const user = userEvent.setup();
		const onFile = jest.fn();
		render(<CSVDropzone onFileSelected={onFile} />);

		const input = document.querySelector('input[type="file"]') as HTMLInputElement;
		await user.upload(input, makeFile("prices.csv", "factoryCode,cutCode,price,date\n"));

		const clearBtn = screen.getByText("Choose a different file");
		await user.click(clearBtn);

		expect(screen.getByText("Drop CSV here, or click to browse")).toBeInTheDocument();
		expect(onFile).toHaveBeenLastCalledWith(null);
	});
});
