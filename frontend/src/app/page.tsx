import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/utils/supabase';

export const revalidate = 0;

export default async function Home() {
  let services = [];
  try {
    const { data, error } = await supabase.from('services').select('*').gt('price', 0); 
    if (!error && data) {
        services = data;
    }
  } catch (err) {
    console.error("Failed to fetch services", err);
  }

  return (
    <div className="flex flex-col items-center">
      {/* Hero Section */}
      <section className="w-full relative h-[80vh] flex items-center justify-center bg-dark-900 border-b border-gold-500/10 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
            <Image src="https://images.unsplash.com/photo-1585747860715-2ba37e788b70?q=80&w=2074&auto=format&fit=crop" alt="Barbershop Background" fill className="object-cover" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/80 to-transparent"></div>
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-white mb-6 uppercase">
            Maskülen <span className="text-gold-500">&amp;</span> KUSURSUZ
          </h1>
          <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
            Geleneksel berber sanatını modern lüks ile buluşturuyoruz. Tarzınızı yansıtacak detaylar Yetmans Barbershop'ta.
          </p>
          <Link href="/randevu" className="inline-block px-8 py-4 bg-gold-500 text-dark-950 font-bold tracking-widest uppercase hover:bg-gold-400 transition-all duration-300 transform hover:scale-105 rounded-sm">
            Hemen Randevu Al
          </Link>
        </div>
      </section>

      {/* About Section */}
      <section className="w-full py-24 bg-dark-950 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           <div className="grid md:grid-cols-2 gap-16 items-center">
             <div>
               <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 uppercase tracking-wider">Erkeklere Özel <br/><span className="text-gold-500">Klasik Deneyim</span></h2>
               <div className="w-20 h-1 bg-gold-500 mb-8"></div>
               <p className="text-gray-400 leading-relaxed mb-6">
                 Yetmans Barbershop sıradan bir erkek kuaförü değil; tarzına önem veren erkeklerin buluşma noktasıdır. Uzman ekibimiz, en iyi ürünleri kullanarak size rahatlatıcı ve birinci sınıf bir bakım sunar. Kalabalıktan uzak, sadece size ayrılan zamanın tadını çıkarın.
               </p>
               <Link href="/galeri" className="text-gold-500 hover:text-gold-400 font-medium tracking-wider uppercase inline-flex items-center group">
                 Çalışmalarımızı Görün 
                 <span className="ml-2 transition-transform group-hover:translate-x-1">→</span>
               </Link>
             </div>
              <div className="relative h-[400px]">
                <Image 
                  src="/gallery/1.jpeg" 
                  alt="Barber Details" 
                  fill 
                  unoptimized
                  className="object-cover object-[center_65%] rounded-sm border border-gold-500/20" 
                />
                <div className="absolute -inset-4 border border-gold-500/30 rounded-sm -z-10 translate-x-4 translate-y-4"></div>
              </div>
           </div>
        </div>
      </section>

      {/* Services / Pricing Section */}
      <section className="w-full py-24 bg-dark-900 border-t border-b border-gold-500/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white uppercase tracking-wider">Hizmetlerimiz</h2>
            <div className="w-20 h-1 bg-gold-500 mx-auto mt-6"></div>
          </div>
          
          <div className="space-y-8">
            {services.length > 0 ? (
                services.map((service: any) => (
                    <div key={service.id} className="flex justify-between items-end border-b border-gray-800 pb-4 group">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-200 group-hover:text-gold-500 tracking-wide transition-colors">{service.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">{service.description}</p>
                      </div>
                      <div className="text-xl font-bold text-gold-500 ml-4 whitespace-nowrap">
                        ₺{service.price}
                      </div>
                    </div>
                ))
            ) : (
                <p className="text-center text-gray-500">Hizmet listesi yükleniyor...</p>
            )}
          </div>
          
          <div className="mt-16 text-center">
             <Link href="/randevu" className="inline-block border border-gold-500 text-gold-500 px-8 py-3 font-medium tracking-widest uppercase hover:bg-gold-500 hover:text-dark-950 transition-all">
               Sıranı Ayırt
             </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
