import type { Metadata } from 'next';
import './globals.css';
import './studio.css';
export const metadata: Metadata = { title: 'FreeFrame Cloud — Creative Review Studio', description: 'A focused workspace for media review, feedback, and approvals.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
