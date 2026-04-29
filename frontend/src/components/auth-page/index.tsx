"use client";

import { useRouter } from "next/navigation";
import {
  Lightning,
  ChartLineUp,
  ShieldCheck,
  GithubLogo,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { SPRING_DEFAULTS } from "@/lib/motion";
import { FloatElement } from "@/components/ui/ShimmerCard";
import { TopoLines } from "@/components/ui/GeometricArt";

import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { UpdatePasswordForm } from "./UpdatePasswordForm";
import type { AuthPageProps } from "./auth-types";

export function AuthPage(props: AuthPageProps) {
  const router = useRouter();

  const renderFooter = () => {
    switch (props.type) {
      case "login":
        return (
          <p className="mt-6 text-center text-sm text-gray-500">
            Don&apos;t have an account?{" "}
            <button
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
            <button
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
      case "login": return "Welcome back";
      case "register": return "Create your account";
      case "forgotPassword": return "Reset your password";
      case "updatePassword": return "Create new password";
      default: return "Welcome";
    }
  };

  const renderDescription = () => {
    switch (props.type) {
      case "login": return "Enter your credentials to access your account";
      case "register": return "Start your 14-day free trial. No credit card required.";
      case "forgotPassword": return "Enter your email and we'll send you a reset link";
      case "updatePassword": return "Create a strong password for your account";
      default: return "";
    }
  };

  const renderForm = () => {
    switch (props.type) {
      case "login": return <LoginForm />;
      case "register": return <RegisterForm />;
      case "forgotPassword": return <ForgotPasswordForm />;
      case "updatePassword": return <UpdatePasswordForm token={(props as { token?: string }).token || ""} />;
      default: return <LoginForm />;
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Side — Clean editorial treatment */}
      <div className="hidden md:flex md:w-[45%] lg:w-[50%] flex-col justify-between relative overflow-hidden bg-black dark:bg-gray-950 text-white p-12">
        {/* Dot pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        {/* Ambient gradient blobs */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 50% 50% at 10% 90%, rgba(184, 134, 11, 0.08), transparent), radial-gradient(ellipse 40% 40% at 80% 20%, rgba(184, 134, 11, 0.06), transparent)",
          }}
        />

        {/* Topographic lines decoration */}
        <TopoLines className="absolute bottom-0 left-0 opacity-50" />

        {/* Content */}
        <div className="relative z-10">
          {/* Logo */}
          <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-white">
            <Lightning size={32} weight="duotone" className="text-gray-900" />
          </div>

          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight" style={{ letterSpacing: "-0.03em" }}>
            MT
          </h1>
          <p className="mt-4 max-w-sm text-lg leading-relaxed text-white/60">
            Commodity market intelligence with real-time data and multi-factor analysis
          </p>
        </div>

        {/* Features */}
        <div className="relative z-10 space-y-6">
          {[
            { icon: <ChartLineUp size={24} weight="duotone" />, title: "55+ Commodities", desc: "Real-time prices across all major markets" },
            { icon: <Lightning size={24} weight="duotone" />, title: "7 AI Models", desc: "Independent signal generation with confidence scores" },
            { icon: <ShieldCheck size={24} weight="duotone" />, title: "Multi-Factor Analysis", desc: "Weather, forex, tariffs, and shipping factors" },
          ].map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.5, duration: 0.6, ease: "easeOut" }}
            >
              <FloatElement duration={4} amplitude={4}>
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 outline outline-white/10 text-primary">
                    {f.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-white/90">{f.title}</p>
                    <p className="text-sm text-white/50">{f.desc}</p>
                  </div>
                </div>
              </FloatElement>
            </motion.div>
          ))}
        </div>

        {/* Social */}
        <div className="relative z-10 flex items-center gap-4 text-white/40">
          <GithubLogo size={20} weight="duotone" className="cursor-pointer text-white/40 transition-colors hover:text-white" />
        </div>
      </div>

      {/* Right Side — Clean form with micro-interactions */}
      <div className="flex flex-1 items-center justify-center bg-white dark:bg-gray-900 px-6 py-12 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_DEFAULTS, delay: 0.1 }}
          className="w-full max-w-md"
        >
          {/* Gold accent bar — animated width */}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: 48 }}
            transition={SPRING_DEFAULTS}
            className="mb-8 h-1 rounded-full bg-primary"
          />

          <h2 className="font-display text-3xl font-semibold text-gray-900 dark:text-white">
            {renderTitle()}
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            {renderDescription()}
          </p>

          {/* Form */}
          <div className="mt-8">
            {renderForm()}
          </div>

          {/* Footer */}
          {renderFooter()}

          {/* Terms */}
          <div className="mt-8 border-t border-gray-100 dark:border-gray-800 pt-6 text-center">
            <p className="text-xs text-gray-400">
              By continuing, you agree to our{" "}
              <a href="#" className="text-gray-500 hover:text-gray-700">Terms of Service</a>
              {" "}and{" "}
              <a href="#" className="text-gray-500 hover:text-gray-700">Privacy Policy</a>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default AuthPage;
