import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { createClient } from '@/utils/supabase/server';

// GET /api/admin/pending — Tüm pending randevuları detaylarıyla getir
export async function GET() {
  const supabaseServer = await createClient();
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id,
      first_name,
      last_name,
      phone,
      date,
      time,
      status,
      created_at,
      staff_id,
      staff:staff_id (id, name),
      services:service_id (id, name, price)
    `)
    .eq('status', 'pending')
    .order('date', { ascending: true })
    .order('time', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    data.map((item: any) => ({
      ...item,
      service: item.services,
      staff: item.staff,
    }))
  );
}

// PATCH /api/admin/pending — Onayla veya Reddet (WhatsApp trigger dahil)
export async function PATCH(request: Request) {
  const supabaseServer = await createClient();
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { id, status } = body;

  if (!id || !['confirmed', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Geçersiz parametreler' }, { status: 400 });
  }

  // Durumu güncelle
  const { data, error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', id)
    .select(`
      id, first_name, last_name, phone, date, time, status,
      services:service_id (name, price),
      staff:staff_id (name)
    `)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // WhatsApp mesaj linkini yanıt ile döndür (Frontend açacak)
  const formattedAppt = { ...data, service: (data as any).services };
  return NextResponse.json({
    appointment: formattedAppt,
    whatsapp_trigger: buildWhatsAppUrl(formattedAppt, status),
  });
}

function buildWhatsAppUrl(appt: any, status: string): string {
  let phone = appt.phone.replace(/\D/g, '');
  if (phone.startsWith('0')) phone = '90' + phone.substring(1);
  else if (phone.length === 10) phone = '90' + phone;

  let message = '';
  const date = new Date(appt.date + 'T12:00:00').toLocaleDateString('tr-TR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  const time = appt.time.substring(0, 5);

  if (status === 'confirmed') {
    message = `Merhaba ${appt.first_name}, Yetman's Barbershop'tan ${date} saat ${time} için oluşturduğunuz randevunuz onaylanmıştır. Sizi bekliyoruz! ✂️`;
  } else {
    message = `Merhaba ${appt.first_name}, Yetman's Barbershop'a göstermiş olduğunuz ilgiden dolayı teşekkür ederiz. Maalesef yoğunluk sebebiyle ${date} saat ${time} tarihindeki randevu talebinizi onaylayamıyoruz. Anlayışınız için teşekkür ederiz.`;
  }

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
