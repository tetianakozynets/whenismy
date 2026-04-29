import { parseIcalUrl } from './recollect.ts'

Deno.test('parseIcalUrl: parses fastly URL', () => {
  const url = 'https://recollect.a.ssl.fastly.net/api/places/BCCDF30E-578B-11E4-AD38-5839C200407A/services/208/events.en.ics'
  const parts = parseIcalUrl(url)
  if (!parts) throw new Error('Expected non-null result')
  if (parts.placeId !== 'BCCDF30E-578B-11E4-AD38-5839C200407A') throw new Error(`Wrong placeId: ${parts.placeId}`)
  if (parts.serviceId !== '208') throw new Error(`Wrong serviceId: ${parts.serviceId}`)
})

Deno.test('parseIcalUrl: parses api.recollect.net URL', () => {
  const url = 'https://api.recollect.net/api/places/F2BCBBF2-ACC9-11E8-B4BD-CFDD30C1D4D8/services/761/events.en-US.ics'
  const parts = parseIcalUrl(url)
  if (!parts) throw new Error('Expected non-null result')
  if (parts.placeId !== 'F2BCBBF2-ACC9-11E8-B4BD-CFDD30C1D4D8') throw new Error(`Wrong placeId: ${parts.placeId}`)
  if (parts.serviceId !== '761') throw new Error(`Wrong serviceId: ${parts.serviceId}`)
})

Deno.test('parseIcalUrl: returns null for unrecognised URL', () => {
  if (parseIcalUrl('https://example.com/not-a-recollect-url') !== null) throw new Error('Expected null')
})

Deno.test('parseIcalUrl: works with client_id query param present', () => {
  const url = 'https://recollect.a.ssl.fastly.net/api/places/BCCDF30E-578B-11E4-AD38-5839C200407A/services/208/events.en.ics?client_id=6FBD18FE-167B-11EC-992A-C843A7F05606'
  const parts = parseIcalUrl(url)
  if (!parts) throw new Error('Expected non-null even with client_id')
  if (parts.serviceId !== '208') throw new Error(`Wrong serviceId: ${parts.serviceId}`)
})
