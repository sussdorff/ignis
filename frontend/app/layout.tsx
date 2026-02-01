import React from "react"
import type { Metadata } from 'next'

import { Analytics } from '@vercel/analytics/next'
import './globals.css'

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"

import { Fira_Sans, Fira_Mono, Montserrat as V0_Font_Montserrat, Geist_Mono as V0_Font_Geist_Mono, Noto_Serif as V0_Font_Noto_Serif } from 'next/font/google'

// Initialize fonts
const _montserrat = V0_Font_Montserrat({ subsets: ['latin'], weight: ["100","200","300","400","500","600","700","800","900"] })
const _geistMono = V0_Font_Geist_Mono({ subsets: ['latin'], weight: ["100","200","300","400","500","600","700","800","900"] })
const _notoSerif = V0_Font_Noto_Serif({ subsets: ['latin'], weight: ["100","200","300","400","500","600","700","800","900"] })

const _firaSans = Fira_Sans({ 
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
});

const _firaMono = Fira_Mono({ 
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: 'Ignis - Praxismanagement',
  description: 'German medical practice management system',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de">
      <body className="font-sans antialiased">
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            {children}
          </SidebarInset>
        </SidebarProvider>
        <Analytics />
      </body>
    </html>
  )
}
