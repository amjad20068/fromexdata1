import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FROMEX - Corporate Attendance & Accounting Management',
  description: 'Enterprise workforce attendance, payroll salary calculation, financial accounting ledger, and MongoDB database monitoring'
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1.0
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
