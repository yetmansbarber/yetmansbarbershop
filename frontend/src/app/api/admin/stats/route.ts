import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { createClient } from '@/utils/supabase/server';

// GET /api/admin/stats
// Toplam Kazanç + Toplam Randevu: Ayın 1'i → bugün sonu, sadece confirmed gerçek randevular
// Bekleyen: tüm zamanlar, sadece pending
export async function GET(request: Request) {
  const supabaseServer = await createClient();
  const { data: { user }, error: authError } = await supabaseServer.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const allTime = searchParams.get('allTime') === 'true';

  // Türkiye saatine göre bugün (UTC+3)
  const nowUTC = new Date();
  const nowTR = new Date(nowUTC.getTime() + 3 * 60 * 60 * 1000);

  const year = nowTR.getUTCFullYear();
  const month = nowTR.getUTCMonth() + 1;
  const day = nowTR.getUTCDate();

  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const todayStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // Sistem kayıtlarını (MOLA, AÇIK vs.) hariç tut
  const SYSTEM_NAMES = ['🔴 MOLA', '🟢 AÇIK'];

  let query = supabase
    .from('appointments')
    .select(`id, date, status, first_name, services:service_id (price)`)
    .eq('status', 'confirmed');

  // Dönem filtresi
  if (!allTime) {
    query = query.gte('date', monthStart).lte('date', todayStr);
  }

  const { data: confirmedData, error: confirmedError } = await query;

  if (confirmedError) {
    return NextResponse.json({ error: confirmedError.message }, { status: 500 });
  }

  // Sistem kayıtlarını fiyat hesabından çıkar
  let totalRevenue = 0;
  let totalCount = 0;

  if (confirmedData) {
    confirmedData.forEach((appt: any) => {
      // Sistem/mola kayıtlarını atla
      if (SYSTEM_NAMES.some(name => appt.first_name?.includes(name))) return;
      totalCount++;
      const price = appt.services?.price;
      if (price) totalRevenue += Number(price);
    });
  }

  // Tüm zamanlardaki pending randevuların sayısı (sistem kayıtları hariç)
  // NOT: pending sistem kayıtları zaten yok (onlar confirmed/unblocked)
  const { count: pendingCount, error: pendingError } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  if (pendingError) {
    return NextResponse.json({ error: pendingError.message }, { status: 500 });
  }

  return NextResponse.json({
    totalRevenue,
    totalCount,
    pendingCount: pendingCount ?? 0,
    periodStart: allTime ? null : monthStart,
    periodEnd: allTime ? null : todayStr,
    allTime,
  });
}

