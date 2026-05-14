"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

// ── Tipler ──────────────────────────────────────────────────
interface Appointment {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  date: string;
  time: string;
  status: string;
  service?: { name: string; price?: number };
  staff?: { id: number; name: string };
  staff_id?: number | null;
}

interface StaffSelf {
  id: number;
  name: string;
  role: string;
}

// ── Sabitler ────────────────────────────────────────────────
const DEFAULT_START = 10;
const DEFAULT_END = 20;
const OTO_MOLALAR = ['10:00', '11:30', '12:30', '14:30', '16:30', '18:30'];

const generateSlotsForDay = (dateStr: string, schedule: any) => {
  const isSunday = new Date(`${dateStr}T12:00:00`).getDay() === 0;
  
  if (schedule && schedule.is_closed) return { isClosed: true, slots: [] };
  if (!schedule && isSunday) return { isClosed: true, slots: [] };

  let startStr = schedule?.start_time ? schedule.start_time.substring(0, 5) : '10:00';
  let endStr = schedule?.end_time ? schedule.end_time.substring(0, 5) : '20:30';

  const parseMins = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  let startMins = parseMins(startStr);
  let endMins = parseMins(endStr);

  if (endMins < startMins) {
    endMins += 24 * 60; // Ertesi güne sarkıyor (gece mesaisi)
  }

  const slots = [];
  for (let m = startMins; m <= endMins; m += 30) {
    const h = Math.floor(m / 60) % 24;
    const mins = m % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(mins).padStart(2, '0')}`);
  }

  return { isClosed: false, slots: [...new Set(slots)] };
};

const getLocalISODate = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().split('T')[0];
};

// ── Ana Bileşen ─────────────────────────────────────────────
export default function PanelPage() {
  const supabase = createClient();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getLocalISODate(new Date()));

  // Giriş yapan kişinin staff kaydı (null ise admin/tüm görünüm)
  const [staffSelf, setStaffSelf] = useState<StaffSelf | null | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState(false);

  const [daySchedule, setDaySchedule] = useState<{ isClosed: boolean, slots: string[] }>({ isClosed: false, slots: [] });
  const [scheduleLoading, setScheduleLoading] = useState(true);

  // ── Auth + Staff Kaydı Kontrolü ─────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/login'; return; }

      // Bu kullanıcının rolünü kontrol et
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('id', user.id)
        .single();

      const role = roleData?.role ?? 'staff';
      setIsAdmin(role === 'admin');

      // Bu auth user'a bağlı staff kaydı var mı?
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, name, role')
        .eq('auth_user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      setStaffSelf(staffData ?? null);
    };
    init();
  }, []);

  // ── Randevuları ve Takvimi Çek ─────────────────────────────────────
  const fetchAppointmentsAndSchedule = useCallback(async () => {
    setLoading(true);
    setScheduleLoading(true);
    try {
      // 1. Randevuları çek
      const res = await fetch(`/api/admin/appointments?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) setAppointments(await res.json());

      // 2. O günün mesai programını çek
      const { data: scheduleData } = await supabase
        .from('custom_schedules')
        .select('*')
        .eq('date', selectedDate)
        .maybeSingle();

      setDaySchedule(generateSlotsForDay(selectedDate, scheduleData));
    } catch (err) {
      console.error('Veri çekme hatası:', err);
    } finally {
      setLoading(false);
      setScheduleLoading(false);
    }
  }, [selectedDate, supabase]);

  // staffSelf yüklendikten veya tarih değiştikten sonra fetch et
  useEffect(() => {
    if (staffSelf !== undefined) fetchAppointmentsAndSchedule();
  }, [staffSelf, selectedDate, fetchAppointmentsAndSchedule]);

  // ── Yardımcı Fonksiyonlar ────────────────────────────────
  const formatPhoneForWA = (phone: string) => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = '90' + cleaned.substring(1);
    else if (cleaned.length === 10) cleaned = '90' + cleaned;
    return cleaned;
  };

  const openWhatsApp = (phone: string, status: string, firstName: string, date: string, time: string) => {
    const waPhone = formatPhoneForWA(phone);
    let message = '';
    if (status === 'confirmed') {
      message = `Merhaba ${firstName}, Yetman's Barbershop'tan ${date} saat ${time} için oluşturduğunuz randevunuz onaylanmıştır. Sizi bekliyoruz!`;
    } else {
      message = `Merhaba ${firstName}, Yetman's Barbershop'a göstermiş olduğunuz ilgiden dolayı teşekkür ederiz. Maalesef yoğunluk sebebiyle ${date} saat ${time} tarihindeki randevu talebinizi onaylayamıyoruz. Anlayışınız için teşekkür ederiz.`;
    }
    window.location.href = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
  };

  const updateStatus = async (id: number, status: string, phone: string, firstName: string, date: string, time: string) => {
    if (!confirm(`Bu randevuyu ${status === 'confirmed' ? 'Onaylamak' : 'Reddetmek'} istediğinize emin misiniz?`)) return;
    const res = await fetch('/api/admin/appointments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      fetchAppointmentsAndSchedule();
      openWhatsApp(phone, status, firstName, date, time);
    } else {
      const e = await res.json();
      alert('Hata: ' + (e.error || 'Bilinmeyen hata'));
    }
  };

  const cancelAppointment = async (id: number, phone: string, firstName: string, date: string, time: string) => {
    if (!confirm(`DİKKAT: ${firstName} adlı müşterinin onaylı randevusunu iptal etmek istediğinize emin misiniz?`)) return;
    const res = await fetch(`/api/admin/appointments?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      fetchAppointmentsAndSchedule();
      const waPhone = formatPhoneForWA(phone);
      const message = `Merhaba ${firstName}, Yetman's Barbershop'tan ${date} saat ${time} için oluşturduğunuz randevunuz elimizde olmayan sebeplerden dolayı iptal edilmek zorunda kalınmıştır. Anlayışınız için teşekkür ederiz.`;
      window.location.href = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`;
    } else {
      alert('İptal işlemi sırasında bir hata oluştu.');
    }
  };

  const handleBlockSlot = async (time: string, dbApptId?: number) => {
    if (!confirm(`${time} saatini randevuya kapatmak istediğinize emin misiniz?`)) return;
    if (dbApptId) {
      await fetch(`/api/admin/appointments?id=${dbApptId}`, { method: 'DELETE' });
    } else {
      const { data: services } = await supabase.from('services').select('id').limit(1);
      const validServiceId = services && services.length > 0 ? services[0].id : null;
      if (!validServiceId) { alert('Hata: Önce hizmet ekleyin.'); return; }

      await supabase.from('appointments').insert([{
        service_id: validServiceId,
        first_name: '🔴 MOLA',
        last_name: 'KAPALI',
        phone: '0000000000',
        date: selectedDate,
        time: `${time}:00`,
        status: 'confirmed',
        staff_id: staffSelf ? staffSelf.id : null,
      }]);
    }
    fetchAppointmentsAndSchedule();
  };

  const handleUnblockSlot = async (id: number | null, time: string, isOtoMola: boolean) => {
    if (!confirm('Bu molayı kaldırıp saati geri açmak istediğinize emin misiniz?')) return;
    if (isOtoMola) {
      const { data: services } = await supabase.from('services').select('id').limit(1);
      const validServiceId = services && services.length > 0 ? services[0].id : 1;
      await supabase.from('appointments').insert([{
        service_id: validServiceId,
        first_name: '🟢 AÇIK',
        last_name: 'MOLA İPTALİ',
        phone: '0000000000',
        date: selectedDate,
        time: `${time}:00`,
        status: 'unblocked',
        staff_id: staffSelf ? staffSelf.id : null,
      }]);
    } else if (id) {
      await fetch(`/api/admin/appointments?id=${id}`, { method: 'DELETE' });
    }
    fetchAppointmentsAndSchedule();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const changeDate = (days: number) => {
    const d = new Date(`${selectedDate}T12:00:00`);
    d.setDate(d.getDate() + days);
    setSelectedDate(getLocalISODate(d));
  };

  // ── Yükleme Ekranı ───────────────────────────────────────
  if (loading || staffSelf === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-yellow-500/50 border-t-yellow-500 rounded-full animate-spin" />
      </div>
    );
  }

  // ── Filtreleme ───────────────────────────────────────────
  // staffSelf varsa (çırak): sadece kendi randevuları + personelsiz sistem kayıtları
  // staffSelf yoksa (admin): tüm randevular
  const appointmentsForDate = appointments.filter((a: Appointment) => {
    if (a.date !== selectedDate) return false;
    if (a.status === 'rejected') return false;
    if (staffSelf) {
      // Sadece kendi randevuları + sistem kayıtları (mola/açık)
      const isSystemRecord = a.first_name === '🔴 MOLA' || a.first_name === '🟢 AÇIK';
      if (isSystemRecord) return true;
      return a.staff_id === staffSelf.id || a.staff_id === null;
    }
    return true;
  });

  const [displayYil, displayAy, displayGun] = selectedDate.split('-').map(Number);
  const displayDate = new Date(displayYil, displayAy - 1, displayGun).toLocaleDateString('tr-TR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const dateObjForDay = new Date(`${selectedDate}T12:00:00`);
  const dayOfWeek = dateObjForDay.getDay();
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-4">
        <div className="mb-4 md:mb-0">
          <h1 className="text-2xl font-bold text-white uppercase tracking-wider text-gold-500">
            Berber Paneli
            {staffSelf && (
              <span className="ml-3 text-sm font-normal text-yellow-500/70 normal-case tracking-normal">
                — {staffSelf.name}
              </span>
            )}
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {staffSelf
              ? `${staffSelf.name} olarak giriş yaptınız. Yalnızca kendi randevularınızı görüyorsunuz.`
              : 'Günlük randevu çizelgenizi buradan yönetin.'}
          </p>
        </div>
        <div className="flex gap-3">
          {isAdmin && (
            <Link
              href="/admin"
              className="text-sm px-4 py-2 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 rounded-sm transition-colors"
            >
              Yönetici Paneli
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="text-sm px-4 py-2 border border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white rounded-sm transition-colors"
          >
            Çıkış Yap
          </button>
        </div>
      </div>

      {/* Tarih Navigasyonu */}
      <div className="bg-dark-900 border border-gold-500/20 p-4 rounded-sm flex flex-col sm:flex-row justify-between items-center mb-8 shadow-md">
        <button
          onClick={() => changeDate(-1)}
          className="px-4 py-2 text-gray-400 hover:text-gold-500 hover:bg-dark-950 rounded-sm transition-colors"
        >
          ← Önceki Gün
        </button>

        <div className="flex items-center gap-4 my-4 sm:my-0">
          <span className="font-bold text-lg text-white capitalize">{displayDate}</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-dark-950 border border-gray-700 text-gray-300 text-sm rounded-sm p-2 focus:border-gold-500 focus:outline-none"
          />
        </div>

        <button
          onClick={() => changeDate(1)}
          className="px-4 py-2 text-gray-400 hover:text-gold-500 hover:bg-dark-950 rounded-sm transition-colors"
        >
          Sonraki Gün →
        </button>
      </div>

      {/* Randevu Listesi */}
      {scheduleLoading ? (
        <div className="bg-dark-950 border border-gray-800 rounded-sm p-12 flex justify-center shadow-lg">
          <div className="w-8 h-8 border-2 border-gold-500/50 border-t-gold-500 rounded-full animate-spin" />
        </div>
      ) : daySchedule.isClosed ? (
        <div className="bg-dark-950 border border-gray-800 rounded-sm p-12 text-center shadow-lg">
          <div className="w-16 h-16 bg-red-900/20 text-red-500 flex items-center justify-center rounded-full mx-auto mb-4 text-2xl">
            🔴
          </div>
          <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-widest">Bugün Mesaiye Kapalıdır</h3>
          <p className="text-gray-400">
            {isAdmin ? "Mesai yönetimi panelinden bu günü açabilirsiniz." : "Yönetici bu günü tatil olarak ayarlamış."}
          </p>
          {isAdmin && (
            <Link href="/admin/mesai" className="inline-block mt-6 px-6 py-2 border border-gold-500/50 text-gold-500 hover:bg-gold-500 hover:text-black transition-colors rounded-sm uppercase text-sm font-bold tracking-wider">
              Mesai Ayarlarına Git
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-dark-950 border border-gray-800 rounded-sm overflow-hidden shadow-lg">
          {daySchedule.slots.map((time) => {
            const realAppts = appointmentsForDate.filter(
              (a) =>
                a.time.substring(0, 5) === time &&
                a.status !== 'unblocked' &&
                a.first_name !== '🔴 MOLA' &&
                a.first_name !== '🟢 AÇIK'
            );
            const activeAppt = realAppts[0] ?? null;

            const markerAppts = appointmentsForDate.filter(
              (a) =>
                a.time.substring(0, 5) === time &&
                (a.status === 'unblocked' || a.first_name === '🔴 MOLA' || a.first_name === '🟢 AÇIK')
            );
            const markerAppt = markerAppts[0] ?? null;

            const isUnblockedMola = markerAppt?.status === 'unblocked' || markerAppt?.first_name === '🟢 AÇIK';
            const isManualMola = markerAppt?.first_name === '🔴 MOLA';
            let isOtoMola = false;

            if (!activeAppt && !markerAppt && isWeekday && OTO_MOLALAR.includes(time)) {
              isOtoMola = true;
            }

            const showAsMola = isManualMola || isOtoMola;

            return (
              <div
                key={time}
                className={`flex flex-col md:flex-row border-b border-gray-800/50 last:border-0 transition-colors hover:bg-dark-900/50 ${
                  activeAppt
                    ? activeAppt.status === 'pending'
                      ? 'bg-yellow-500/5'
                      : 'bg-green-500/5'
                    : showAsMola
                    ? 'bg-red-900/10'
                    : ''
                }`}
              >
                {/* Saat */}
                <div className="w-full md:w-32 py-4 px-6 flex items-center justify-center md:justify-start border-b md:border-b-0 md:border-r border-gray-800/50">
                  <span className={`text-lg font-bold tracking-widest ${showAsMola ? 'text-red-500' : activeAppt ? 'text-white' : 'text-gray-600'}`}>
                    {time}
                  </span>
                </div>

                {/* İçerik */}
                <div className="flex-1 p-4 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  {showAsMola ? (
                    <div className="flex justify-between items-center w-full bg-red-900/20 border border-red-500/30 p-3 rounded-sm">
                      <span className="text-red-400 font-bold uppercase tracking-widest text-sm">
                        {isOtoMola ? '🔴 OTOMATİK MOLA (KAPALI)' : '🔴 BU SAAT RANDEVUYA KAPATILDI'}
                      </span>
                      <button
                        onClick={() => handleUnblockSlot(markerAppt?.id ?? null, time, isOtoMola)}
                        className="px-3 py-1 bg-red-600/20 text-red-400 border border-red-500 hover:bg-red-500 hover:text-white transition-colors text-xs uppercase font-bold rounded-sm ml-4"
                      >
                        Geri Aç
                      </button>
                    </div>
                  ) : activeAppt ? (
                    <>
                      <div>
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <h3 className="font-bold text-lg text-white capitalize">
                            {activeAppt.first_name} {activeAppt.last_name}
                          </h3>
                          {activeAppt.status === 'pending' && (
                            <span className="bg-yellow-500/10 border border-yellow-500/50 text-yellow-500 text-[10px] px-2 py-0.5 uppercase font-bold tracking-widest rounded-full">
                              Onay Bekliyor
                            </span>
                          )}
                          {activeAppt.status === 'confirmed' && (
                            <div className="flex items-center gap-3">
                              <span className="bg-green-500/10 border border-green-500/50 text-green-500 text-[10px] px-2 py-0.5 uppercase font-bold tracking-widest rounded-full">
                                Onaylı
                              </span>
                              <button
                                onClick={() => cancelAppointment(activeAppt.id, activeAppt.phone, activeAppt.first_name, activeAppt.date, activeAppt.time)}
                                className="px-3 py-1 bg-red-600/10 text-red-500 border border-red-600 hover:bg-red-600 hover:text-white transition-colors uppercase font-bold text-[10px] tracking-wider rounded-sm"
                              >
                                İptal Et
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="text-gray-400 text-sm flex flex-col sm:flex-row sm:gap-4 gap-1">
                          <span>✂️ {activeAppt.service?.name}</span>
                          <span>📞 {activeAppt.phone}</span>
                          {/* Admin görünümünde hangi personelin randevusu olduğunu göster */}
                          {!staffSelf && activeAppt.staff && (
                            <span className="text-yellow-600/70">👤 {activeAppt.staff.name}</span>
                          )}
                        </div>
                      </div>

                      {activeAppt.status === 'pending' && (
                        <div className="flex gap-2 w-full md:w-auto mt-4 md:mt-0">
                          <button
                            onClick={() => updateStatus(activeAppt.id, 'confirmed', activeAppt.phone, activeAppt.first_name, activeAppt.date, activeAppt.time)}
                            className="flex-1 md:flex-none px-4 py-2 bg-green-600/10 text-green-500 border border-green-600 hover:bg-green-600 hover:text-white transition-colors uppercase font-bold text-[11px] tracking-wider rounded-sm"
                          >
                            Onayla
                          </button>
                          <button
                            onClick={() => updateStatus(activeAppt.id, 'rejected', activeAppt.phone, activeAppt.first_name, activeAppt.date, activeAppt.time)}
                            className="flex-1 md:flex-none px-4 py-2 bg-red-600/10 text-red-500 border border-red-600 hover:bg-red-600 hover:text-white transition-colors uppercase font-bold text-[11px] tracking-wider rounded-sm"
                          >
                            Reddet
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-between w-full text-gray-600">
                      <span className="italic uppercase tracking-widest text-sm">
                        {isUnblockedMola ? '🟢 İSTİSNA (GERİ AÇILDI) - BOŞ SEANS' : 'BOŞ SEANS'}
                      </span>
                      <button
                        onClick={() => handleBlockSlot(time, isUnblockedMola ? markerAppt?.id : undefined)}
                        className="px-3 py-1 border border-gray-700 hover:border-gray-500 hover:text-white transition-colors text-xs uppercase font-bold rounded-sm ml-4"
                      >
                        Saati Kapat
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}