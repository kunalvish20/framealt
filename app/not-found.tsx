import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  return <div className="setup-page"><FileQuestion size={36}/><h1>Page not found</h1><p>This page does not exist, or the link is no longer available.</p><Link href="/dashboard" className="btn btn-primary">Back to projects</Link><Link href="/" className="text-link">FreeFrame home</Link></div>;
}
