import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { createClient } from '@/utils/supabase/server';

// GET /api/admin/schedules?date=YYYY-MM-DD (veya tümü)
export async function GET(request: Request) {
  const supabaseServer = await createClient();
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  let query = supabase
    .from('custom_schedules')
    .select('*')
    .order('date', { ascending: true });

  if (date) {
    query = query.eq('date', date);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/admin/schedules — Özel gün ekle/güncelle (upsert)
export async function POST(request: Request) {
  const supabaseServer = await createClient();
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { date, is_closed, start_time, end_time, note } = body;

  if (!date) return NextResponse.json({ error: 'Date required' }, { status: 400 });

  const { data, error } = await supabase
    .from('custom_schedules')
    .upsert(
      { date, is_closed: is_closed ?? false, start_time: start_time || null, end_time: end_time || null, note: note || null },
      { onConflict: 'date' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/admin/schedules?date=YYYY-MM-DD — Özelleştirmeyi sil (standarda dön)
export async function DELETE(request: Request) {
  const supabaseServer = await createClient();
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  if (!date) return NextResponse.json({ error: 'Date required' }, { status: 400 });

  const { error } = await supabase
    .from('custom_schedules')
    .delete()
    .eq('date', date);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
