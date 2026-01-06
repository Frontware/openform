import type { Metadata, Viewport } from "next";
import { DM_Sans, Plus_Jakarta_Sans, Outfit, Sora, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import "../globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#6366f1",
};

export const metadata: Metadata = {
  title: "Weladee Form - Create Beautiful Forms",
  description: "Build stunning forms with Weladee Form. Free and open source.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Weladee Form",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
    ],
  },
  other: {
    "application-name": "Weladee Form",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const messages = await getMessages();

  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#6366f1" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152x152.png" />
        <link rel="icon" sizes="192x192" href="/icons/icon-192x192.png" />
        <link rel="icon" sizes="512x512" href="/icons/icon-512x512.png" />
      </head>
      <body
        className={`${dmSans.variable} ${plusJakarta.variable} ${outfit.variable} ${sora.variable} ${inter.variable} antialiased`}
      >
        <NextIntlClientProvider messages={messages} locale="en">
          {children}
        </NextIntlClientProvider>
        <Toaster richColors position="top-center" />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
