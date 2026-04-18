import { prisma, logger } from '@/lib';

// Plan limits
const PLAN_LIMITS: Record<string, Record<string, number>> = {
  free: {
    watchlists: 1,
    watchlistItems: 5,
    simAccounts: 1,
    signalsPerDay: 10,
    apiCalls: 100,
    historyDays: 30,
  },
  pro: {
    watchlists: 10,
    watchlistItems: 50,
    simAccounts: 3,
    signalsPerDay: 100,
    apiCalls: 5000,
    historyDays: 365,
  },
  enterprise: {
    watchlists: Infinity,
    watchlistItems: Infinity,
    simAccounts: Infinity,
    signalsPerDay: Infinity,
    apiCalls: Infinity,
    historyDays: Infinity,
  },
};

export function getPlanLimits(plan: string): Record<string, number> {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}

export async function getUserPlan(userId: string): Promise<{ plan: string; limits: Record<string, number> }> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
  });

  const plan = sub?.status === 'active' ? (sub.plan || 'free') : 'free';
  return { plan, limits: getPlanLimits(plan) };
}

export async function checkLimit(userId: string, feature: string, currentCount: number): Promise<boolean> {
  const { limits } = await getUserPlan(userId);
  const limit = limits[feature];

  if (limit === Infinity) return true;
  if (currentCount >= limit) return false;
  return true;
}

export async function trackUsage(userId: string, feature: string): Promise<void> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!sub) return;

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  try {
    await prisma.usageRecord.upsert({
      where: {
        subscriptionId_feature_periodStart: {
          subscriptionId: sub.id,
          feature,
          periodStart,
        },
      },
      create: {
        subscriptionId: sub.id,
        feature,
        count: 1,
        periodStart,
        periodEnd,
      },
      update: {
        count: { increment: 1 },
      },
    });
  } catch (err) {
    logger.debug(`[UsageService] Failed to track usage: ${err}`);
  }
}
