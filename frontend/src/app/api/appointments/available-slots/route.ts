import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';

// Standart mesai sabitleri
const DEFAULT_START_H = 10;
const DEFAULT_START_M = 0;
const DEFAULT_END_H = 20;
const DEFAULT_END_M = 30;

// Otomatik mola saatleri (sadece hafta içi)
const OTO_MOLALAR = ['10:00', '11:30', '12:30', '14:30', '16:30', '18:30'];

/** Dakika cinsinden saat hesapla */
function toMinutes(h: number, m: number) {
  return h * 60 + m;
}

/**
 * Belirtilen mesai aralığında 30 dakikalık slot listesi üretir.
 * Gece mesaisi desteği: bitiş saati başlangıçtan küçükse ertesi güne sarıyor
 * demektir — bunu da "toplam dakika" mantığıyla çözüyoruz.
 */
function generateSlots(startH: number, startM: number, endH: number, endM: number): string[] {
  const slots: string[] = [];
  let current = toMinutes(startH, startM);
  // Bitiş toplam dakikası (gece mesaisinde 30 saat gibi davranır)
  let end = toMinutes(endH, endM);

  // Gece mesaisi: end < start → end'i +24 saat olarak kabul et
  if (end <= current) {
    end += 24 * 60;
  }

  // Son slot END'e eşit olmamalı (son randevu END'e 30 dk önce alınabilir mantığı)
  // Aslında "son randevuyu saat 20:30'da alabilmeli" demek: slot 20:30 dahil
  // Dolayısıyla current <= end olduğu sürece ekle
  while (current <= end) {
    const h = Math.floor(current / 60) % 24;
    const m = current % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    current += 30;
  }

  return slots;
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
  let startH = customSchedule?.start_time
    ? parseInt(customSchedule.start_time.split(':')[0])
    : DEFAULT_START_H;
  let startM = customSchedule?.start_time
    ? parseInt(customSchedule.start_time.split(':')[1])
    : DEFAULT_START_M;
  let endH = customSchedule?.end_time
    ? parseInt(customSchedule.end_time.split(':')[0])
    : DEFAULT_END_H;
  let endM = customSchedule?.end_time
    ? parseInt(customSchedule.end_time.split(':')[1])
    : DEFAULT_END_M;

  const slots = generateSlots(startH, startM, endH, endM);

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

    // Hafta içi otomatik mola (sadece custom schedule yoksa)
    if (!customSchedule && isWeekday && OTO_MOLALAR.includes(slot)) {
      if (!unblockedTimes.includes(slot)) return false;
    }

    return true;
  });

  return NextResponse.json({ available_slots: availableSlots, is_closed: false });
}