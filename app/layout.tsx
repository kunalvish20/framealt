import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/components/AuthProvider';
import './globals.css';
import './studio.css';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });
export const metadata: Metadata = { title: 'FreeFrame — Media Review & Collaboration', description: 'Review video, images and audio with timecoded feedback, visual markup, version history and secure sharing.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={inter.variable}><body><AuthProvider>{children}</AuthProvider></body></html>;
}
