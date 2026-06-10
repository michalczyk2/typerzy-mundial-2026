'use client'
import { useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { GroupTable } from '@/components/groups/GroupTable'

export default function GrupyPage() {
  const { standings } = useAppStore()

  const groups = useMemo(() => {
    const map = new Map<string, typeof standings>()
    standings.forEach(s => {
      const arr = map.get(s.group_name) || []
      arr.push(s)
      map.set(s.group_name, arr)
    })
    return Array.from(map.entries()).sort((a,b) => a[0].localeCompare(b[0]))
  }, [standings])

  return (
    <div>
      <h1 className="text-2xl font-black text-white mb-6">Grupy</h1>
      {standings.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Brak danych grupowych — zostaną załadowane po starcie turnieju.</div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {groups.map(([groupName, groupStandings]) => (
            <GroupTable key={groupName} groupName={groupName} standings={groupStandings} />
          ))}
        </div>
      )}
      <div className="mt-6 bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 className="text-white font-bold mb-3">Fazy turnieju</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {[
            ['Faza grupowa', '12 czerwca – 2 lipca 2026'],
            ['1/32 finału', '6–9 lipca 2026'],
            ['1/16 finału', '14–17 lipca 2026'],
            ['Ćwierćfinały', '22–23 lipca 2026'],
            ['Półfinały', '28–29 lipca 2026'],
            ['Finał', '19 lipca 2026'],
          ].map(([phase, date]) => (
            <div key={phase} className="flex flex-col">
              <span className="text-gray-300 font-medium">{phase}</span>
              <span className="text-gray-600 text-xs">{date}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
