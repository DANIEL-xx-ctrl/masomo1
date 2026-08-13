'use client'

import { useAppStore } from '@/lib/store'
import { FetchInterceptor } from '@/components/fetch-interceptor'
import Login from '@/components/login'
import AppShell from '@/components/app-shell'

export default function Home() {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)

  if (isAuthenticated) {
    return (
      <FetchInterceptor>
        <AppShell />
      </FetchInterceptor>
    )
  }

  return <Login />
}
