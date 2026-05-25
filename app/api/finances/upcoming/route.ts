import { NextResponse } from 'next/server'

// This route is no longer called by the UI — kept for backwards compatibility.
export async function GET() {
  return NextResponse.json({ data: [] })
}
