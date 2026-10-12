"use client"

import { useEffect, useState } from "react"

function format(since: number, now: number) {
  const s = Math.max(0, Math.round((now - since) / 1000))
  if (s < 45) return "just now"
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return new Date(since).toLocaleString()
}

/** "just now", "2 min ago", … kept up to date; the exact time shows on hover. */
export function TimeAgo({ since, className }: { since: number; className?: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(t)
  }, [])
  return (
    <time dateTime={new Date(since).toISOString()} title={new Date(since).toLocaleString()} className={className}>
      {format(since, now)}
    </time>
  )
}
