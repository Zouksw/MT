/**
 * MSW Server Setup
 *
 * Sets up MSW for use in Jest tests (Node environment).
 * Import and call setup()/teardown() in test files.
 */

import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);

export function setupMsw() {
	beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
	afterEach(() => server.resetHandlers());
	afterAll(() => server.close());
}
