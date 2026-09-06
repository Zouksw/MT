/** Extracted from prisma/seed.ts (round-156 批3a) — data-only move, logic unchanged. */
import type { UserRole } from "@prisma/client";
export interface UserInfo {
	email: string;
	password: string;
	name: string;
	role: UserRole;
	avatarUrl?: string;
}

export const USERS: UserInfo[] = [
	{
		email: process.env.SEED_ADMIN_EMAIL ?? "admin@trademind.com",
		// Password sourced from env so real credentials are never committed.
		// Falls back to a dev-only placeholder when SEED_ADMIN_PASSWORD is unset.
		password: process.env.SEED_ADMIN_PASSWORD ?? "Admin123!",
		name: "System Administrator",
		role: "ADMIN",
		avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=SA&backgroundColor=3b82f6",
	},
	{
		email: process.env.SEED_USER_EMAIL ?? "user@trademind.com",
		password: process.env.SEED_USER_PASSWORD ?? "User123!",
		name: "Jane DataScientist",
		role: "EDITOR",
		avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=JD&backgroundColor=10b981",
	},
	{
		email: process.env.SEED_DEMO_EMAIL ?? "demo@trademind.com",
		password: process.env.SEED_DEMO_PASSWORD ?? "Demo123!",
		name: "Demo User",
		role: "VIEWER",
		avatarUrl: "https://api.dicebear.com/7.x/initials/svg?seed=DU&backgroundColor=f59e0b",
	},
];
