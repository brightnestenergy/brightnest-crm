// Supabase Edge Function: sync-leads
// Fetches the public Google Sheet CSV and upserts new leads

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SHEET_CSV = 'https://docs.google.com/spreadsheets/d/1gsfQKQJ_Cpt8mk8P-nW8IWO5HHLpXKRhk86_Ge34SII/export?format=csv&gid=0'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const res = await fetch(SHEET_CSV)
    const text = await res.text()
    const rows = parseCSV(text)
    if (rows.length < 2) return new Response(JSON.stringify({ error: 'Empty sheet' }), { status: 400 })

    const headers = rows[0].map(h => h.toLowerCase().trim())
    const get = (row: string[], keys: string[]) => {
      for (const k of keys) {
        const i = headers.indexOf(k)
        if (i >= 0 && row[i]) return row[i]
      }
      return ''
    }

    let added = 0
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]
      const sourceId = get(r, ['id'])
      const name = get(r, ['name'])
      if (!name || name.length < 2) continue

      const postcode = get(r, ['postal_code', 'postcode'])
      const suburb = get(r, ['city', 'suburb'])
      const tooFar = isTooFar(postcode, suburb)

      const { error } = await supabase.from('leads').upsert({
        source_id: sourceId || null,
        name,
        phone: get(r, ['phone']),
        email: get(r, ['email']),
        address: get(r, ['address']),
        suburb,
        postcode,
        state: get(r, ['state']) || 'VIC',
        bill: get(r, ['average_monthly_electric_bill', 'bill']),
        timeline: get(r, ['intended_installation_time', 'timeline']),
        notes: get(r, ['remarks']),
        too_far: tooFar,
        status: 'new',
        needs_follow_up: true,
      }, { onConflict: 'source_id', ignoreDuplicates: true })

      if (!error) added++
    }

    return new Response(JSON.stringify({ ok: true, added }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})

function parseCSV(text: string): string[][] {
  const lines = text.trim().split('\n')
  return lines.map(line => {
    const cols: string[] = []
    let current = '', inQuotes = false
    for (const c of line) {
      if (c === '"') inQuotes = !inQuotes
      else if (c === ',' && !inQuotes) { cols.push(current.trim()); current = '' }
      else current += c
    }
    cols.push(current.trim())
    return cols
  })
}

function isTooFar(postcode: string, suburb: string): boolean {
  const pc = String(postcode || '').trim()
  if (!pc) return false
  const n = parseInt(pc, 10)
  if (n && (n < 3000 || n > 3999)) return true
  const far = ['ballarat','geelong','bendigo','gippsland','warrnambool','mildura','shepparton']
  return far.some(k => (suburb || '').toLowerCase().includes(k))
}
