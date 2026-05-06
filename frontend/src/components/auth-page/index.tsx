"use client";

import { GithubLogo, Lightning } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { SPRING_DEFAULTS } from "@/lib/motion";
import type { AuthPageProps } from "./auth-types";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";
import { UpdatePasswordForm } from "./UpdatePasswordForm";

export function AuthPage(props: AuthPageProps) {
	const router = useRouter();

	const renderFooter = () => {
		switch (props.type) {
			case "login":
				return (
					<p className="mt-6 text-center text-sm text-gray-500">
						Don&apos;t have an account?{" "}
						<button type="button"
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
						<button type="button"
							onClick={() => router.push("/login")}
							className="font-semibold text-primary hover:text-primary-hover"
						>
							Sign in
						</button>
					</p>
				);
			case "forgotPassword":
			case "updatePassword":
				return (
					<div className="mt-6 text-center">
						<button type="button"
							onClick={() => router.push("/login")}
							className="text-sm text-gray-500 hover:text-gray-700"
						>
							← Back to login
						</button>
					</div>
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
			case "forgotPassword":
				return "Reset your password";
			case "updatePassword":
				return "Create new password";
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
			case "forgotPassword":
				return "Enter your email and we'll send you a reset link";
			case "updatePassword":
				return "Create a strong password for your account";
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
			case "forgotPassword":
				return <ForgotPasswordForm />;
			case "updatePassword":
				return <UpdatePasswordForm token={(props as { token?: string }).token || ""} />;
			default:
				return <LoginForm />;
		}
	};

	return (
		<div className="flex min-h-screen">
			{/* Left Side — Dark brand panel, refined industrial */}
			<div className="hidden md:flex md:w-[45%] lg:w-[50%] flex-col justify-between relative overflow-hidden bg-[#0a0a0a] text-white p-12">
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
							"radial-gradient(ellipse 60% 40% at 50% 80%, rgba(184, 134, 11, 0.07), transparent)",
					}}
				/>

				{/* Brand mark */}
				<div className="relative z-10">
					<div className="mb-10 flex h-14 w-14 items-center justify-center rounded-xl bg-[#B8860B]/10 ring-1 ring-[#B8860B]/20">
						<Lightning size={28} weight="duotone" className="text-[#B8860B]" />
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
						108 commodities.
						<br />
						7 AI models.
						<br />
						<span className="text-[#B8860B]">One signal.</span>
					</p>
					<p className="mt-4 text-sm text-white/40">
						AI-powered commodity market analytics
					</p>
				</motion.div>

				{/* Footer */}
				<div className="relative z-10 flex items-center gap-4 text-white/30">
					<GithubLogo
						size={18}
						weight="duotone"
						className="cursor-pointer transition-colors hover:text-white/60"
					/>
					<span className="text-xs">&copy; 2026 MT</span>
				</div>
			</div>

			{/* Right Side — Form */}
			<div className="flex flex-1 items-center justify-center bg-white dark:bg-[#111] px-6 py-12 md:px-12">
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
						className="mb-8 h-1 rounded-full bg-[#B8860B]"
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
						<p className="text-xs text-gray-400">
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
