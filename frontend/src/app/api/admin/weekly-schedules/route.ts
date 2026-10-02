import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('weekly_closed_slots')
      .select('*')
      .order('day_of_week', { ascending: true })
      .order('slot_time', { ascending: true });

    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { day_of_week, slot_time } = body;

    if (day_of_week === undefined || !slot_time) {
      return NextResponse.json({ error: 'Eksik parametreler' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('weekly_closed_slots')
      .insert([{ day_of_week, slot_time }])
      .select()
      .single();

    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (err: any) {
    // 23505 = Unique constraint violation
    if (err.code === '23505') {
       return NextResponse.json({ error: 'Bu saat zaten kapalı.' }, { status: 400 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const day_of_week = searchParams.get('day_of_week');
    const slot_time = searchParams.get('slot_time');

    if (!day_of_week || !slot_time) {
      return NextResponse.json({ error: 'Eksik parametreler' }, { status: 400 });
    }

    const { error } = await supabase
      .from('weekly_closed_slots')
      .delete()
      .eq('day_of_week', day_of_week)
      .eq('slot_time', slot_time);

    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
