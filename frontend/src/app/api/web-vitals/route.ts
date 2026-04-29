import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const metric = await request.json();

    // Log web vitals for monitoring
    // eslint-disable-next-line no-console
    console.log("Web Vital:", {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      timestamp: metric.timestamp,
    });

    // In production, you would send this to your analytics service
    // Examples:
    // - Google Analytics
    // - Vercel Analytics
    // - Custom analytics database
    // - Datadog, New Relic, etc.

    if (process.env.NODE_ENV === "production") {
      // Send to your analytics service here
      // await analyticsService.trackWebVital(metric);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to process web vital:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process web vital" },
      { status: 400 }
    );
  }
}
