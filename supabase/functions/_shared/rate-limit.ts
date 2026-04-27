import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface RateLimitConfig {
  key: string
  maxPerMinute: number
  maxPerDay: number
}

export async function checkRateLimit(
  supabase: SupabaseClient,
  config: RateLimitConfig
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const now = new Date()
  const minuteWindow = new Date(Math.floor(now.getTime() / 60000) * 60000).toISOString()
  const dayWindow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

  const [minuteResult, dayResult] = await Promise.all([
    supabase.rpc('increment_rate_limit', { p_key: `${config.key}:min`, p_window: minuteWindow }),
    supabase.rpc('increment_rate_limit', { p_key: `${config.key}:day`, p_window: dayWindow }),
  ])

  const minuteCount = minuteResult.data ?? 0
  const dayCount = dayResult.data ?? 0

  if (minuteCount > config.maxPerMinute) {
    return { allowed: false, retryAfter: 60 }
  }
  if (dayCount > config.maxPerDay) {
    return { allowed: false, retryAfter: 86400 }
  }
  return { allowed: true }
}
