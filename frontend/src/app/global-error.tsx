"use client";

import { TriangleAlert } from "lucide-react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="max-w-[600px] text-center">
            <div className="w-[120px] h-[120px] rounded-[30px] bg-gray-100 flex items-center justify-center mx-auto mb-8 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.08)]">
              <TriangleAlert className="size-16 text-primary" strokeWidth={1.5} />
            </div>

            <h1 className="text-gray-900 text-[clamp(32px,5vw,48px)] font-semibold mb-4 leading-tight">Something went wrong</h1>
            <p className="text-lg text-gray-600 mb-10 leading-relaxed">
              We encountered an unexpected error. Don&apos;t worry, our team has been notified and we&apos;re working to fix it.
            </p>

            {process.env.NODE_ENV === "development" && error.message && (
              <div className="bg-gray-100 rounded-lg p-4 mb-8 text-left border">
                <p className="text-[13px] text-gray-600 font-mono whitespace-pre-wrap break-words m-0">{error.message}</p>
              </div>
            )}

            <div className="flex gap-4 justify-center flex-wrap">
              <button onClick={() => reset()} className="h-12 px-8 text-base font-semibold rounded-lg bg-primary text-white border-none cursor-pointer hover:bg-primary-hover transition-colors">
                Try Again
              </button>
              <a href="/" className="h-12 px-8 text-base font-semibold rounded-lg bg-white text-gray-900 border inline-flex items-center hover:bg-gray-50 transition-colors">
                Go Home
              </a>
            </div>

            <div className="mt-12">
              <p className="text-sm text-gray-400 mb-4">Need help? Here are some useful links:</p>
              <div className="flex gap-6 justify-center flex-wrap">
                <a href="/dashboard" className="text-sm text-primary hover:opacity-70 transition-opacity">Dashboard</a>
                <a href="/login" className="text-sm text-primary hover:opacity-70 transition-opacity">Login</a>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
