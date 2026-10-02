import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const day_of_week = searchParams.get('day_of_week');
    const slot_time = searchParams.get('slot_time');

    if (day_of_week === null || !slot_time) {
      return NextResponse.json({ error: 'Eksik parametreler' }, { status: 400 });
    }

    const dayNum = parseInt(day_of_week, 10);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Sadece gelecekteki ve bugünkü (henüz geçmemiş) randevuları kontrol et
    // Statüsü pending veya confirmed olanlar (gerçek müşteri randevuları)
    const { data: futureAppointments, error } = await supabase
      .from('appointments')
      .select('id, date, time, first_name, last_name, status')
      .gte('date', todayStr)
      .in('status', ['pending', 'confirmed']);

    if (error) throw error;

    // Bu randevuların haftanın o gününe ve saatine denk gelip gelmediğine bak
    const conflicts = (futureAppointments || []).filter((appt: any) => {
      // 1. Saat eşleşiyor mu? (veritabanından 10:30 veya 10:30:00 gelebilir)
      if (appt.time.substring(0, 5) !== slot_time.substring(0, 5)) return false;

      // 2. Gün eşleşiyor mu?
      const [year, month, day] = appt.date.split('-').map(Number);
      const apptDateObj = new Date(year, month - 1, day);
      return apptDateObj.getDay() === dayNum;
    });

    return NextResponse.json({ 
        conflict_count: conflicts.length, 
        conflicts: conflicts.map((c: any) => ({
            date: c.date,
            time: c.time,
            name: `${c.first_name} ${c.last_name}`,
            status: c.status
        })) 
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
