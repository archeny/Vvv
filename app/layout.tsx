// by Stenly
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Chat Mobile',
  description: 'AI Chat Mobile App',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="w-full h-full m-0 p-0">
      <body className="antialiased bg-white w-full h-full m-0 p-0 overflow-hidden text-gray-900" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
