import type { Metadata, Viewport } from 'next';
import { Bebas_Neue, DM_Sans } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import BottomNav from '@/src/components/BottomNav';
import ChatWidget from '@/src/components/ChatWidget';
import { ThemeProvider } from '@/src/context/ThemeContext';
import { ShopProvider }  from '@/src/context/ShopContext';
import { FavoritesProvider } from '@/src/context/FavoritesContext';

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas-neue',
  display: 'swap',
});

const dmSans = DM_Sans({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Treats by Foodician — Premium Pickup',
  description: 'Order ahead, pay securely, and pick up your hot local delicacies.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Foodician' },
};

export const viewport: Viewport = {
  themeColor: '#E8192C',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bebasNeue.variable} ${dmSans.variable} dark h-full`}>
      <head>
        <Script src="https://js.paystack.co/v1/inline.js" strategy="beforeInteractive" />
      </head>
      <body className="h-full overflow-hidden bg-[#050505] text-[#F5F5F5] antialiased">
        <ThemeProvider>
          <ShopProvider>
            <FavoritesProvider>
              <div className="flex flex-col h-full w-full bg-[#050505]">
                <main className="flex-1 overflow-y-auto no-scrollbar pb-[80px] page-safe-pad animate-slide-in-up">
                  {children}
                </main>
                <BottomNav />
                <ChatWidget />
              </div>
            </FavoritesProvider>
          </ShopProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
