const EVENT_ICONS: Record<string, string> = {
  garbage: '🗑️',
  recycling: '♻️',
  yard_waste: '🌿',
  bulk_waste: '📦',
}

export function eventTypeIcon(eventType: string): string {
  return EVENT_ICONS[eventType] ?? '🚛'
}
