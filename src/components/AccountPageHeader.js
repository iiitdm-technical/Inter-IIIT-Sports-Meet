'use client';

import { usePathname } from 'next/navigation';
import PageHeader from './PageHeader';

const headers = {
  '/login': { title: 'Sign In', description: 'Access the IIIT registration portal.', badgeLabel: 'Welcome' },
  '/register': { title: 'Registration', description: 'Build your contingent and complete your registration for the meet.', badgeLabel: 'Register' },
  '/admin': { title: 'Admin Dashboard', description: 'Manage registrations, event entries, and payment records.', badgeLabel: 'Organise' },
};

export default function AccountPageHeader() {
  const pathname = usePathname();
  return headers[pathname] ? <PageHeader key={pathname} {...headers[pathname]} headingTag="h2" /> : null;
}
