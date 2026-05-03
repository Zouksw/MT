import { redirect } from "next/navigation";
import { AuthPage } from "@/components/auth-page";
import { authProviderServer } from "@/providers/auth-provider/auth-provider.server";

export default async function Login() {
	const data = await getData();

	if (data.authenticated) {
		redirect(data?.redirectTo || "/");
	}

	return <AuthPage type="login" />;
}

async function getData() {
	const { authenticated, redirectTo, error } = await authProviderServer.check();

	return {
		authenticated,
		redirectTo,
		error,
	};
}
