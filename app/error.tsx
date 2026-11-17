'use client';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="setup-page"><AlertCircle size={34}/><h1>Something went wrong</h1><p>The page could not load. Try again, or return to your projects.</p><button className="btn btn-primary" onClick={reset}>Try again</button><Link href="/dashboard" className="text-link">Back to projects</Link></div>;
}
