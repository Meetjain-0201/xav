import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { WLS_GROUPS } from '@/lib/scenarios'

/**
 * GET /api/assign-group
 * Returns the next group number in round-robin sequence (0 → 1 → 2 → 3 → 4 → 0 → …).
 * Derived from the count of existing rows in `responses`, so it's durable across sessions.
 * Race condition risk is negligible for N=20.
 */
export async function GET() {
  const { count, error } = await supabase
    .from('responses')
    .select('*', { count: 'exact', head: true })

  if (error) {
    // Fall back to random if DB is unreachable
    return NextResponse.json({ group: Math.floor(Math.random() * WLS_GROUPS) })
  }

  const group = (count ?? 0) % WLS_GROUPS
  return NextResponse.json({ group })
}
