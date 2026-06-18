import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export function getFlagUrl(code: string): string {
  return `https://flagcdn.com/w40/${code.toLowerCase()}.png`
}
export function formatMatchDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Warsaw' })
}
export function formatMatchTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' })
}
export function isMatchLocked(matchDate: string): boolean {
  return new Date(matchDate) <= new Date()
}
export function getPhaseLabel(phase: string): string {
  const labels: Record<string,string> = { group:'Faza grupowa', round_of_32:'1/32 finału', round_of_16:'1/16 finału', quarterfinal:'Ćwierćfinał', semifinal:'Półfinał', third_place:'Mecz o 3. miejsce', final:'Finał' }
  return labels[phase] || phase
}
export function getMatchStatusLabel(status: string): string {
  const l: Record<string,string> = { scheduled:'Zaplanowany', live:'NA ŻYWO', finished:'Zakończony', postponed:'Przełożony', cancelled:'Odwołany' }
  return l[status] || status
}
export function getCountdown(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff <= 0) return ''
  const days = Math.floor(diff/86400000)
  const hours = Math.floor((diff%86400000)/3600000)
  const mins = Math.floor((diff%3600000)/60000)
  if (days > 0) return `Za ${days}d ${hours}h`
  if (hours > 0) return `Za ${hours}h ${mins}m`
  return `Za ${mins} min`
}
