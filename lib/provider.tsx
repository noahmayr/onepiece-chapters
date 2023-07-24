'use client';
import { QueryClient, QueryClientProvider } from 'react-query';
import type { ReactNode } from 'react';

const queryClient = new QueryClient();

export default function Provider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
