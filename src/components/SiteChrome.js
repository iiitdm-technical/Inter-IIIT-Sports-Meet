'use client';
import { usePathname } from 'next/navigation';

// The registration and admin apps have their own headers, so the public
// navbar and footer are left out there.
const APP_ROUTES = ['/register', '/admin'];

export default function SiteChrome({ children }) {
  const pathname = usePathname() || '';
  const isAppRoute = APP_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  return isAppRoute ? null : children;
}
