"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface StaffMember {
  id: number;
  name: string;
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  master: 'Ana Berber',
  apprentice: 'Çırak',
  barber: 'Berber',
};

export default function Randevu() {
  const [step, setStep] = useState(1);
  const [services, setServices] = useState([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  
  // Seçim state'leri
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [userInfo, setUserInfo] = useState({ first_name: '', last_name: '', phone: '' });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [dayIsClosed, setDayIsClosed] = useState(false);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const getLocalISODate = (date: Date) => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().split('T')[0];
  };

  const getDaysArray = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    
    const days = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  };
  
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const getFilteredTimeSlots = () => {
    if (!selectedDate) return [];
    const now = new Date();
    const todayStr = getLocalISODate(now);
    
    if (selectedDate === todayStr) {
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();
      
      return availableSlots.filter(time => {
        const [hourStr, minStr] = time.split(':');
        const hour = parseInt(hourStr, 10);
        const min = parseInt(minStr, 10);
        if (hour < currentHour) return false;
        if (hour === currentHour && min <= currentMin) return false;
        return true;
      });
    }
    return availableSlots;
  };

  const filteredSlots = getFilteredTimeSlots();

  // Hizmetleri yükle
  useEffect(() => {
    fetch('/api/services')
      .then(res => res.json())
      .then(data => setServices(data))
      .catch(err => console.error(err));
  }, []);

  // Personeli yükle
  useEffect(() => {
    fetch('/api/staff')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setStaff(data);
        } else {
          console.error("Staff veri çekme hatası:", data);
        }
      })
      .catch(err => console.error(err));
  }, []);

  // Tarih veya personel seçimi değişince slotları yükle
  useEffect(() => {
    if (selectedDate) {
      setAvailableSlots([]);
      setSelectedTime('');
      setDayIsClosed(false);
      setSlotsLoading(true);

      const staffParam = selectedStaff ? `&staff_id=${selectedStaff.id}` : '';
      
      fetch(`/api/appointments/available-slots?date=${selectedDate}${staffParam}&t=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
          setAvailableSlots(data.available_slots || []);
          setDayIsClosed(data.is_closed === true);
        })
        .catch(err => console.error(err))
        .finally(() => setSlotsLoading(false));
    }
  }, [selectedDate, selectedStaff]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const phoneRegex = /^[0-9\-\+ ]{9,15}$/;
    if (!phoneRegex.test(userInfo.phone)) {
      alert('Lütfen geçerli bir telefon numarası giriniz.');
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: selectedService.id,
          date: selectedDate,
          time: selectedTime,
          first_name: userInfo.first_name,
          last_name: userInfo.last_name,
          phone: userInfo.phone,
          // staff_id opsiyonel — seçilmemişse null geçilir
          ...(selectedStaff ? { staff_id: selectedStaff.id } : {}),
        })
      });

      if (res.ok) {
        setIsSuccess(true);
      } else {
        const errData = await res.json();
        alert(errData.error || 'Bir hata oluştu. Lütfen tekrar deneyin.');
      }
    } catch (err) {
      alert('Sunucuya ulaşılamadı.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => setStep(prev => prev + 1);
  const prevStep = () => setStep(prev => prev - 1);

  // Adım etiketleri — personel seçimi 2. adım olarak eklendi
  const steps = ['Hizmet', 'Personel', 'Tarih & Saat', 'Bilgiler'];

  if (isSuccess) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-white mb-4">Randevu Talebiniz Alınmıştır!</h2>
        <div className="bg-dark-900 border border-gold-500/30 p-6 rounded-sm text-gray-300 max-w-xl mx-auto">
          <p className="font-semibold text-gold-500 mb-2">Önemli Bilgilendirme</p>
          <p>
            Onay işlemleri haftanın her günü{' '}
            <span className="text-white font-bold">10:00 - 20:30</span> mesai saatleri içerisinde yapılmaktadır.
          </p>
          <p className="mt-2">Randevunuz onaylandığında WhatsApp üzerinden bildirim alacaksınız.</p>
          {selectedStaff && (
            <p className="mt-2 text-yellow-500">
              Seçilen personel: <span className="font-bold">{selectedStaff.name}</span>
            </p>
          )}
        </div>
        <Link href="/" className="inline-block mt-8 px-6 py-3 bg-gold-500 text-dark-950 font-bold tracking-widest uppercase hover:bg-gold-400 transition-colors">
          Ana Sayfaya Dön
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <div className="mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-white uppercase tracking-wider text-center">Randevu Al</h1>
        <div className="w-20 h-1 bg-gold-500 mx-auto mt-4 mb-10" />
        {/* Adım göstergesi */}
        <div className="flex justify-between items-center max-w-2xl mx-auto relative">
          {steps.map((label, idx) => (
            <div key={idx} className="flex flex-col items-center relative z-10 w-20">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= idx + 1 ? 'bg-gold-500 text-dark-950' : 'bg-dark-800 text-gray-500 border border-gray-700'}`}>
                {idx + 1}
              </div>
              <span className={`text-[10px] mt-2 uppercase tracking-wide text-center w-full ${step >= idx + 1 ? 'text-gold-500' : 'text-gray-500'}`}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-dark-900 border border-gold-500/10 p-6 md:p-10 rounded-sm">

        {/* ADIM 1: Hizmet */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-medium text-white mb-6 uppercase tracking-wider">Hizmet Seçiniz</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {services.length > 0 ? services.map((svc: any) => (
                <div
                  key={svc.id}
                  onClick={() => setSelectedService(svc)}
                  className={`p-4 border rounded-sm cursor-pointer transition-all ${selectedService?.id === svc.id ? 'border-gold-500 bg-gold-500/5' : 'border-gray-800 hover:border-gray-600 bg-dark-950'}`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-gray-200 uppercase tracking-wide">{svc.name}</h3>
                    <span className="text-gold-500 font-bold">₺{svc.price}</span>
                  </div>
                  <p className="text-sm text-gray-500">{svc.duration_minutes} Dk - {svc.description}</p>
                </div>
              )) : <p className="text-gray-500 p-4">Hizmetler yükleniyor...</p>}
            </div>
            <div className="mt-8 flex justify-end">
              <button
                onClick={nextStep}
                disabled={!selectedService}
                className="px-6 py-3 bg-gold-500 text-dark-950 font-bold disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
              >
                İleri
              </button>
            </div>
          </div>
        )}

        {/* ADIM 2: Personel Seçimi */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-medium text-white mb-6 uppercase tracking-wider">Personel Seçiniz</h2>
            <div className="space-y-3">

              {staff.map((member) => (
                <div
                  key={member.id}
                  onClick={() => setSelectedStaff(member)}
                  className={`p-4 border rounded-sm cursor-pointer transition-all flex items-center gap-4 ${
                    selectedStaff?.id === member.id
                      ? 'border-gold-500 bg-gold-500/5'
                      : 'border-gray-800 hover:border-gray-600 bg-dark-950'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-xl font-bold text-white uppercase">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-200">{member.name}</h3>
                    <p className="text-sm text-gray-500">
                      {ROLE_LABELS[member.role] ?? member.role}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-between">
              <button onClick={prevStep} className="px-6 py-3 border border-gray-600 text-gray-300 uppercase tracking-wider hover:text-white">Geri</button>
              <button
                onClick={nextStep}
                disabled={!selectedStaff}
                className="px-6 py-3 bg-gold-500 text-dark-950 font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
              >
                İleri
              </button>
            </div>
          </div>
        )}

        {/* ADIM 3: Tarih & Saat */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-medium text-white mb-6 uppercase tracking-wider">Tarih ve Saat</h2>
            <div>
              <label className="block text-gray-400 mb-4 font-medium uppercase tracking-wider text-sm">Tarih Seçimi</label>
              
              <div className="bg-dark-950 border border-gray-800 rounded-sm p-4 md:p-6 shadow-inner">
                <div className="flex justify-between items-center mb-6">
                  <button
                    onClick={() => {
                      const prev = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
                      if (prev.getMonth() >= todayDate.getMonth() || prev.getFullYear() > todayDate.getFullYear()) {
                        setCurrentMonth(prev);
                      }
                    }}
                    className="w-8 h-8 flex items-center justify-center hover:bg-gray-800 rounded-sm transition-colors text-gray-400"
                    disabled={currentMonth.getMonth() === todayDate.getMonth() && currentMonth.getFullYear() === todayDate.getFullYear()}
                    type="button"
                  >
                    &#10094;
                  </button>
                  <span className="font-bold text-gold-500 uppercase tracking-widest text-sm md:text-base">
                    {currentMonth.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                    className="w-8 h-8 flex items-center justify-center hover:bg-gray-800 rounded-sm transition-colors text-gray-400"
                    type="button"
                  >
                    &#10095;
                  </button>
                </div>
                
                <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(d => <div key={d} className="pb-2">{d}</div>)}
                </div>
                
                <div className="grid grid-cols-7 gap-1 md:gap-2">
                  {getDaysArray().map((day, idx) => {
                    if (!day) return <div key={`empty-${idx}`} className="p-2" />;
                    
                    const isPast = day < todayDate;
                    const isSunday = day.getDay() === 0;
                    const dateStr = getLocalISODate(day);
                    const isSelected = selectedDate === dateStr;
                    
                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={isPast}
                        onClick={() => {
                          setSelectedDate(dateStr);
                          setSelectedTime('');
                        }}
                        className={`p-2 md:p-3 w-full flex items-center justify-center rounded-sm text-sm font-medium transition-all duration-200
                          ${isPast ? 'text-gray-700 cursor-not-allowed opacity-40 bg-dark-950/50' :
                            isSunday ? 'text-red-800 cursor-pointer border border-red-900/20 hover:border-red-700/30' :
                            isSelected ? 'bg-gold-500 text-dark-950 font-bold scale-105 shadow-[0_0_10px_rgba(212,175,55,0.3)]' :
                            'text-gray-300 hover:bg-gold-500/10 hover:text-gold-500 hover:border-gold-500/30 border border-transparent'}`}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-600 mt-3 text-center">
                  🔴 Kırmızı = Pazar (özel mesai olabilir)
                </p>
              </div>
            </div>
            
            {selectedDate && (
              <div className="mt-8">
                <label className="block text-gray-400 mb-4 font-medium uppercase tracking-wider text-sm">
                  Saat Seçimi
                  {selectedStaff && (
                    <span className="text-xs text-gray-600 ml-2 lowercase normal-case tracking-normal">
                      ({selectedStaff.name} için uygun saatler)
                    </span>
                  )}
                </label>
                {slotsLoading ? (
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {[1,2,3,4,5,6,7,8].map(i => (
                      <div key={i} className="h-12 bg-gray-800 rounded-sm animate-pulse" />
                    ))}
                  </div>
                ) : dayIsClosed ? (
                  <div className="bg-red-950/20 border border-red-500/30 rounded-sm p-8 text-center">
                    <p className="text-red-400 font-bold">🔴 Bu Gün Kapalı</p>
                    <p className="text-gray-500 text-sm mt-1">Lütfen başka bir tarih seçiniz.</p>
                  </div>
                ) : filteredSlots.length > 0 ? (
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {filteredSlots.map(time => (
                      <button
                        type="button"
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        className={`text-center py-3 border rounded-sm cursor-pointer transition-all duration-200 text-sm tracking-widest font-medium
                          ${selectedTime === time
                            ? 'bg-gold-500 text-dark-950 border-gold-500 shadow-[0_0_10px_rgba(212,175,55,0.3)]'
                            : 'bg-dark-950 border-gray-700 text-gray-300 hover:border-gold-500/50 hover:bg-gold-500/5'}`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="bg-dark-950 border border-gray-800 rounded-sm p-8 text-center">
                    <p className="text-gray-400 text-sm">Bu gün için uygun randevu saati bulunmuyor.</p>
                  </div>
                )}
              </div>
            )}

            <div className="mt-8 flex justify-between">
              <button onClick={prevStep} className="px-6 py-3 border border-gray-600 text-gray-300 uppercase tracking-wider hover:text-white">Geri</button>
              <button
                onClick={nextStep}
                disabled={!selectedDate || !selectedTime}
                className="px-6 py-3 bg-gold-500 text-dark-950 font-bold disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
              >
                İleri
              </button>
            </div>
          </div>
        )}

        {/* ADIM 4: Kişisel Bilgiler */}
        {step === 4 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-xl font-medium text-white mb-6 uppercase tracking-wider">Kişisel Bilgiler</h2>
            
            <div className="bg-dark-950 p-4 border border-gray-800 mb-6 rounded-sm">
              <div className="flex flex-col md:flex-row justify-between text-sm text-gray-300 gap-2">
                <span className="font-bold text-gold-500">{selectedService?.name}</span>
                <span>{selectedDate} - {selectedTime}</span>
              </div>
              {selectedStaff && (
                <div className="mt-2 text-sm text-gray-500">
                  👤 Personel: <span className="text-gray-300">{selectedStaff.name}</span>
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 mb-2 text-sm uppercase tracking-wide">Adınız</label>
                <input
                  required
                  type="text"
                  value={userInfo.first_name}
                  onChange={(e) => setUserInfo({ ...userInfo, first_name: e.target.value })}
                  className="w-full bg-dark-950 border border-gray-700 text-white p-3 rounded-sm focus:border-gold-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-2 text-sm uppercase tracking-wide">Soyadınız</label>
                <input
                  required
                  type="text"
                  value={userInfo.last_name}
                  onChange={(e) => setUserInfo({ ...userInfo, last_name: e.target.value })}
                  className="w-full bg-dark-950 border border-gray-700 text-white p-3 rounded-sm focus:border-gold-500 focus:outline-none"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-gray-400 mb-2 text-sm uppercase tracking-wide">Telefon (WhatsApp formatı)</label>
              <input
                required
                type="tel"
                placeholder="05XX XXX XX XX"
                value={userInfo.phone}
                onChange={(e) => setUserInfo({ ...userInfo, phone: e.target.value })}
                className="w-full bg-dark-950 border border-gray-700 text-white p-3 rounded-sm focus:border-gold-500 focus:outline-none"
              />
            </div>

            <div className="mt-8 flex justify-between pt-4">
              <button type="button" onClick={prevStep} className="px-6 py-3 border border-gray-600 text-gray-300 uppercase tracking-wider hover:text-white">Geri</button>
              <button
                type="submit"
                disabled={isSubmitting || !userInfo.first_name || !userInfo.last_name || !userInfo.phone}
                className="px-6 py-3 bg-gold-500 text-dark-950 font-bold disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
              >
                {isSubmitting ? 'Gönderiliyor...' : 'Randevuyu Tamamla'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}