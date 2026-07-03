import type { Metadata } from 'next'
import './globals.css'
import { BranchProvider } from '@/lib/branch-context'
import { DateRangeProvider } from '@/lib/date-range-context'

export const metadata: Metadata = {
  title: 'Sri Varuni Dashboard',
  description: 'Internal dashboard for Sri Varuni Fashion Jewellery',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-sv-beige font-body text-sv-ink antialiased">
        <BranchProvider>
          <DateRangeProvider>
            {children}
          </DateRangeProvider>
        </BranchProvider>
      </body>
    </html>
  )
}
