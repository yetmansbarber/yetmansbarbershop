import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';

// Sabit Yasal Slotlar (Öğle Molası yutulmuş hali)
const LEGAL_SLOTS = [
  "09:00", "09:45", "10:30", "11:15", "12:00", "12:45",
  "14:30", "15:15", "16:00", "16:45", "17:30", "18:15",
  "19:00", "19:45", "20:30", "21:15"
];

/** Dakika cinsinden saat hesapla */
function toMinutes(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function generateSlots(startStr: string, endStr: string): string[] {
  let startMins = toMinutes(startStr);
  let endMins = toMinutes(endStr);

  if (endMins < startMins) {
    endMins += 24 * 60; // gece mesaisi
  }

  return LEGAL_SLOTS.filter(slot => {
    let slotMins = toMinutes(slot);
    if (slotMins < startMins && endMins > 24 * 60) {
      slotMins += 24 * 60;
    }
    return slotMins >= startMins && slotMins <= endMins;
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date');
  const staffIdParam = searchParams.get('staff_id');

  if (!dateStr) {
    return NextResponse.json({ error: 'Date parameter is required' }, { status: 400 });
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const dayOfWeek = dateObj.getDay(); // 0=Pazar
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const isSunday = dayOfWeek === 0;

  // ── 1. Custom schedule kontrolü ────────────────────────────
  const { data: scheduleData } = await supabase
    .from('custom_schedules')
    .select('*')
    .eq('date', dateStr)
    .maybeSingle();

  const customSchedule = scheduleData ?? null;

  // Tüm gün kapalıysa boş döndür
  if (customSchedule?.is_closed) {
    return NextResponse.json({ available_slots: [], is_closed: true });
  }

  // Pazar + custom schedule yoksa kapalı
  if (isSunday && !customSchedule) {
    return NextResponse.json({ available_slots: [], is_closed: true });
  }

  // Mesai saatlerini belirle
  let startStr = customSchedule?.start_time ? customSchedule.start_time.substring(0, 5) : '09:00';
  let endStr = customSchedule?.end_time ? customSchedule.end_time.substring(0, 5) : '21:15';

  const slots = generateSlots(startStr, endStr);
  
  // ── 1.5 Haftalık Kalıcı Kapalı Saatleri Çek ─────────────────
  const { data: weeklyClosedData } = await supabase
    .from('weekly_closed_slots')
    .select('slot_time')
    .eq('day_of_week', dayOfWeek);

  const weeklyClosedSlots = (weeklyClosedData ?? []).map((row: any) => row.slot_time.substring(0, 5));

  // ── 2. Veritabanından randevuları çek ──────────────────────
  let dbQuery = supabase
    .from('appointments')
    .select('time, status, staff_id')
    .eq('date', dateStr)
    .in('status', ['pending', 'confirmed', 'unblocked']);

  // Eğer staff_id belirtildiyse o personele ait randevuları filtrele
  // (mola/unblock gibi sistem kayıtları da dahil)
  const { data: dbAppointments, error } = await dbQuery;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // staffId verilmişse sadece o personelin veya personelsiz (sistem) kayıtlarını say
  const staffId = staffIdParam ? parseInt(staffIdParam) : null;

  // Gerçekten dolu saatler (o personele ait veya personel ayrımsız sistem kayıtları)
  const bookedTimes = (dbAppointments ?? [])
    .filter((appt: any) => {
      if (appt.status !== 'pending' && appt.status !== 'confirmed') return false;
      // Eğer müşteri personel seçtiyse: sadece aynı personel doluysa engelle
      if (staffId) return !appt.staff_id || appt.staff_id === staffId;
      // Personel seçmediyse: herhangi bir randevu varsa dolu say
      return true;
    })
    .map((appt: any) => appt.time.substring(0, 5));

  const unblockedTimes = (dbAppointments ?? [])
    .filter((appt: any) => appt.status === 'unblocked')
    .map((appt: any) => appt.time.substring(0, 5));

  // ── 3. Filtreleme ──────────────────────────────────────────
  const availableSlots = slots.filter((slot: string) => {
    // Gerçek randevu veya manuel mola varsa kapalı
    if (bookedTimes.includes(slot)) return false;

    // Haftalık kalıcı kapalı saat ise (custom schedule yoksa geçerli olsun)
    if (!customSchedule && weeklyClosedSlots.includes(slot)) {
      if (!unblockedTimes.includes(slot)) return false;
    }

    return true;
  });

  return NextResponse.json({ available_slots: availableSlots, is_closed: false });
}