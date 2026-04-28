const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

export interface PushMessage {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
}

export interface PushTicket {
  status: 'ok' | 'error'
  id?: string
  message?: string
}

export async function sendPushBatch(messages: PushMessage[]): Promise<PushTicket[]> {
  if (messages.length === 0) return []

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    },
    body: JSON.stringify(messages),
  })

  if (!res.ok) throw new Error(`Expo Push API error: ${res.status}`)
  const { data } = await res.json()
  return data as PushTicket[]
}

export function pickupNotificationMessage(
  eventType: string,
  token: string
): PushMessage {
  const labels: Record<string, string> = {
    garbage: 'Garbage',
    recycling: 'Recycling',
    yard_waste: 'Yard Waste',
  }
  const label = labels[eventType] ?? 'Pickup'
  return {
    to: token,
    title: `${label} pickup tomorrow 🗑️`,
    body: `Don't forget to put your ${label.toLowerCase()} out tonight.`,
    data: { eventType },
  }
}
