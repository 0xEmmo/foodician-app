'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  {
    href: '/',
    label: 'Home',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 stroke-current fill-none stroke-2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    href: '/orders',
    label: 'Orders',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 stroke-current fill-none stroke-2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15 15" />
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 stroke-current fill-none stroke-2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  // Hide nav on admin page
  if (pathname === '/admin') return null;

  return (
    <nav
      className="bottom-nav-safe fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] h-[70px] z-[100] bg-black border-t border-[#262626] flex"
      style={{ boxSizing: 'border-box' }}
    >
      {navItems.map(({ href, label, icon }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all duration-200 ${
              isActive
                ? 'text-[#E8192C] [text-shadow:0_0_10px_rgba(232,25,44,0.4)]'
                : 'text-[#A0A0A0]'
            }`}
          >
            <span
              className={`transition-all duration-200 ${
                isActive ? 'drop-shadow-[0_0_6px_rgba(232,25,44,0.6)] -translate-y-0.5' : ''
              }`}
            >
              {icon}
            </span>
            <span className="text-[0.7rem] font-semibold tracking-[0.5px] uppercase mt-0.5">
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
