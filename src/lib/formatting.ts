const EVENT_LABELS: Record<string, string> = {
  garbage: 'Garbage',
  recycling: 'Recycling',
  yard_waste: 'Yard Waste',
  organics: 'Composting',
  bulk_waste: 'Large Items',
}

export function eventTypeLabel(eventType: string): string {
  return (
    EVENT_LABELS[eventType] ??
    eventType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  )
}

export function formatPickupDate(dateStr: string): string {
  // Add noon to avoid date shifting from UTC conversion on different timezones
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export function daysUntil(dateStr: string): number {
  // Get today's local date at midnight
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Parse the date string as local midnight (no Z suffix) so comparison
  // is timezone-consistent with the local today value above.
  const pickup = new Date(dateStr + 'T00:00:00')

  // Calculate the difference in days
  const diffMs = pickup.getTime() - today.getTime()
  return Math.floor(diffMs / 86_400_000)
}

export function daysUntilLabel(days: number): string {
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}
