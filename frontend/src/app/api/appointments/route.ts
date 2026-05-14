import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { service, date, time, first_name, last_name, phone, staff_id } = body;
    
    if (!service || !date || !time || !first_name || !last_name || !phone) {
        return NextResponse.json({ error: "Eksik alan" }, { status: 400 });
    }

    // Randevu çakışma kontrolü (aynı personel + tarih + saat)
    // staff_id verilmişse o personel için, verilmemişse genel kontrol
    let conflictQuery = supabase
      .from('appointments')
      .select('id')
      .eq('date', date)
      .eq('time', time)
      .in('status', ['pending', 'confirmed']);

    if (staff_id) {
      conflictQuery = conflictQuery.eq('staff_id', staff_id);
    }

    const { data: existing } = await conflictQuery.limit(1);
    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Bu saat dolu. Lütfen başka bir saat seçin.' }, { status: 409 });
    }

    const { error } = await supabase.from('appointments').insert([
      {
        service_id: service,
        date,
        time,
        first_name,
        last_name,
        phone,
        status: 'pending',
        // staff_id yoksa (personel seçilmediyse) NULL kalır — backward compatible
        ...(staff_id ? { staff_id } : {}),
      }
    ]);

    if (error) {
        console.error('Supabase insert error:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err: any) {
    console.error('API route catch error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
