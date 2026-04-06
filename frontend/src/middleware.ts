import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/navigation';

export default createMiddleware(routing);

export const config = {
  matcher: ['/', '/(zh-CN|en)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
