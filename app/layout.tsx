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

const SITE_URL = 'https://treatsbyfoodician.com.ng';

export const metadata: Metadata = {
  title: 'Treats by Foodician — Premium Pickup & Delivery',
  description: 'Order ahead, pay securely. Pickup or delivery from your favourite Lagos restaurant.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Treats by Foodician',
  },
  icons: {
    icon:  '/icon-192.png',
    apple: '/icon-192.png',
  },
  openGraph: {
    title:       'Treats by Foodician',
    description: 'Order ahead, pay securely. Pickup or delivery.',
    url:         SITE_URL,
    siteName:    'Treats by Foodician',
    type:        'website',
    images: [
      {
        url:    `${SITE_URL}/og-image.png`,
        width:  1200,
        height: 630,
        alt:    'Treats by Foodician',
      },
    ],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'Treats by Foodician',
    description: 'Order ahead, pay securely.',
    images:      [`${SITE_URL}/og-image.png`],
  },
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
                <main className="flex-1 overflow-y-auto no-scrollbar animate-slide-in-up" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
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
