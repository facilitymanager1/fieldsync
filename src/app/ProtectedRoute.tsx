"use client";
import React from 'react';
import { useAuth } from './auth';
import { useRouter } from 'next/navigation';

export default function ProtectedRoute({ children, allowed }: { children: React.ReactNode; allowed?: string[] }) {
  const { user } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!user) router.replace('/login');
    else if (allowed && !allowed.includes(user.role || '')) router.replace('/login');
  }, [user, allowed, router]);

  if (!user) return null;
  if (allowed && !allowed.includes(user.role || '')) return null;
  return <>{children}</>;
}
