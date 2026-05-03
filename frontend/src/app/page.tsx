"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { verifyAuthentication } from "@/utils/auth";

export default function IndexPage() {
	const router = useRouter();

	useEffect(() => {
		const checkAuth = async () => {
			try {
				const authenticated = await verifyAuthentication();
				if (authenticated) {
					router.push("/dashboard");
				} else {
					router.push("/landing");
				}
			} catch {
				router.push("/landing");
			}
		};

		checkAuth();
	}, [router]);

	return null;
}
