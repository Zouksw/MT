/**
 * Auth Page Types
 */

export type AuthType = "login" | "register";

export interface AuthPageProps {
	type: AuthType;
	[key: string]: unknown;
}

export interface AuthFormData {
	email?: string;
	password?: string;
	confirmPassword?: string;
	name?: string;
}

export interface AuthFormConfig {
	title: string;
	description: string;
	submitText: string;
	showNameField?: boolean;
	showConfirmPassword?: boolean;
}
