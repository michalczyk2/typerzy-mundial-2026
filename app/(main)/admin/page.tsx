'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { AdminPanel } from '@/components/admin/AdminPanel'

export default function AdminPage() {
  const { currentUser } = useAppStore()
  const router = useRouter()

  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      router.push('/mecze')
    }
  }, [currentUser, router])

  if (!currentUser || currentUser.role !== 'admin') return null

  return (
    <div>
      <h1 className="text-2xl font-black text-white mb-2">Panel admina</h1>
      <p className="text-gray-500 text-sm mb-6">Zarządzaj graczami, wynikami i synchronizacją danych</p>
      <AdminPanel />
    </div>
  )
}
