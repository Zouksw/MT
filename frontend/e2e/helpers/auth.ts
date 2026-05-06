import type { Page } from '@playwright/test';
import { request as pwRequest } from '@playwright/test';

let cachedAuth: { token: string; user: any } | null = null;

async function getAuthOnce(): Promise<{ token: string; user: any }> {
  if (cachedAuth) return cachedAuth;

  const apiContext = await pwRequest.newContext({ baseURL: 'http://localhost:8000' });
  const response = await apiContext.post('/api/auth/login', {
    data: { email: 'admin@trademind.com', password: 'Admin123!' },
  });
  const body = await response.json();
  await apiContext.dispose();
  if (!body.success) throw new Error(`Login failed: ${body.error?.message}`);

  cachedAuth = { token: body.data.token, user: body.data.user };
  return cachedAuth;
}

export async function loginAsAdmin(page: Page) {
  const { token, user } = await getAuthOnce();

  // Set cookies on the app domain before navigating
  await page.goto('about:blank');
  await page.context().addCookies([
    {
      // JWT token — checked by Next.js middleware for route protection
      name: 'token',
      value: token,
      domain: 'localhost',
      path: '/',
      expires: Math.floor(Date.now() / 1000) + 86400,
    },
    {
      // User info cookie — used by auth-provider for identity
      name: 'auth',
      value: encodeURIComponent(JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatarUrl,
        roles: [user.role],
      })),
      domain: 'localhost',
      path: '/',
      expires: Math.floor(Date.now() / 1000) + 86400,
    },
  ]);

  // Navigate and set sessionStorage
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.evaluate((token) => {
    sessionStorage.setItem('auth_token', token);
  }, token);
}

export async function loginAsUser(page: Page) {
  await loginAsAdmin(page);
}

export async function logout(page: Page) {
  await page.evaluate(() => {
    sessionStorage.removeItem('auth_token');
  });
  await page.context().clearCookies();
  await page.goto('/login');
}
