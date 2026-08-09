"use client";

import { motion } from "framer-motion";
import { Code, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { SPRING_DEFAULTS } from "@/lib/motion";
import { SITE_STATS } from "@/lib/site-stats";
import type { AuthPageProps } from "./auth-types";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

export function AuthPage(props: AuthPageProps) {
	const router = useRouter();

	const renderFooter = () => {
		switch (props.type) {
			case "login":
				return (
					<p className="mt-6 text-center text-sm text-gray-500">
						Don&apos;t have an account?{" "}
						<button
							type="button"
							onClick={() => router.push("/register")}
							className="font-semibold text-primary hover:text-primary-hover"
						>
							Sign up
						</button>
					</p>
				);
			case "register":
				return (
					<p className="mt-6 text-center text-sm text-gray-500">
						Already have an account?{" "}
						<button
							type="button"
							onClick={() => router.push("/login")}
							className="font-semibold text-primary hover:text-primary-hover"
						>
							Sign in
						</button>
					</p>
				);
			default:
				return null;
		}
	};

	const renderTitle = () => {
		switch (props.type) {
			case "login":
				return "Welcome back";
			case "register":
				return "Create your account";
			default:
				return "Welcome";
		}
	};

	const renderDescription = () => {
		switch (props.type) {
			case "login":
				return "Enter your credentials to access your account";
			case "register":
				return "Start your 14-day free trial. No credit card required.";
			default:
				return "";
		}
	};

	const renderForm = () => {
		switch (props.type) {
			case "login":
				return <LoginForm />;
			case "register":
				return <RegisterForm />;
			default:
				return <LoginForm />;
		}
	};

	return (
		<div className="flex min-h-screen">
			{/* Left Side — Dark brand panel, refined industrial */}
			<div className="hidden md:flex md:w-[45%] lg:w-[50%] flex-col justify-between relative overflow-hidden bg-gray-950 text-white p-12">
				{/* Dot pattern */}
				<div
					className="pointer-events-none absolute inset-0 opacity-[0.03]"
					style={{
						backgroundImage: "radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)",
						backgroundSize: "24px 24px",
					}}
				/>
				{/* Gold glow — single warm accent */}
				<div
					className="pointer-events-none absolute inset-0"
					style={{
						background:
							"radial-gradient(ellipse 60% 40% at 50% 80%, rgba(139, 105, 20, 0.07), transparent)",
					}}
				/>

				{/* Brand mark */}
				<div className="relative z-10">
					<div className="mb-10 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
						<Zap size={28} className="text-primary" />
					</div>
				</div>

				{/* Central statement — bold, data-driven */}
				<motion.div
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
					className="relative z-10"
				>
					<h1
						className="font-display text-5xl font-semibold leading-[1.1] tracking-tight text-white"
						style={{ letterSpacing: "-0.03em" }}
					>
						MT
					</h1>
					<p className="mt-6 max-w-xs text-xl font-medium leading-relaxed text-white/80">
						{SITE_STATS.beefCuts} beef cuts.
						<br />
						{SITE_STATS.aiModels} AI models.
						<br />
						<span className="text-primary">One signal.</span>
					</p>
					<p className="mt-4 text-sm text-white/40">AI-powered beef trade price intelligence</p>
				</motion.div>

				{/* Footer */}
				<div className="relative z-10 flex items-center gap-4 text-white/30">
					<Code size={18} className="cursor-pointer transition-colors hover:text-white/60" />
					<span className="text-xs">&copy; 2026 MT</span>
				</div>
			</div>

			{/* Right Side — Form */}
			<div className="flex flex-1 items-center justify-center bg-white dark:bg-gray-950 px-6 py-12 md:px-12">
				<motion.div
					initial={{ opacity: 0, y: 16 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ ...SPRING_DEFAULTS, delay: 0.1 }}
					className="w-full max-w-md"
				>
					{/* Gold accent bar */}
					<motion.div
						initial={{ width: 0 }}
						animate={{ width: 48 }}
						transition={SPRING_DEFAULTS}
						className="mb-8 h-1 rounded-full bg-primary"
					/>

					<h2 className="font-display text-3xl font-semibold text-gray-900 dark:text-white">
						{renderTitle()}
					</h2>
					<p className="mt-3 text-base text-muted-foreground">{renderDescription()}</p>

					{/* Form */}
					<div className="mt-8">{renderForm()}</div>

					{/* Footer */}
					{renderFooter()}

					{/* Terms */}
					<div className="mt-8 border-t border-gray-100 dark:border-white/[0.06] pt-6 text-center">
						<p className="text-xs text-muted-foreground">
							By continuing, you agree to our{" "}
							<a href="/terms" className="text-gray-500 hover:text-gray-700">
								Terms of Service
							</a>{" "}
							and{" "}
							<a href="/privacy" className="text-gray-500 hover:text-gray-700">
								Privacy Policy
							</a>
						</p>
					</div>
				</motion.div>
			</div>
		</div>
	);
}

export default AuthPage;
