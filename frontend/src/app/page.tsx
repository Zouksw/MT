"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { verifyAuthentication } from "@/utils/auth";

const LandingPage = dynamic(() => import("./landing/page"), { ssr: false });

export default function IndexPage() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = await verifyAuthentication();
        if (authenticated) {
          router.push("/dashboard");
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Auth check failed:', error);
      }
    };

    checkAuth();
  }, [router]);

  // Show landing page immediately, redirect happens in background if authenticated
  return <LandingPage />;
}
