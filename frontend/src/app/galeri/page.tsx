import Image from 'next/image';
import { supabase } from '@/utils/supabase';

export const revalidate = 0;

interface GalleryItem {
  id: number | string;
  title: string | null;
  image_url: string;
}

const FALLBACK_MEDIA: GalleryItem[] = [
  { id: 1, title: 'Tanıtım Videosu', image_url: '/gallery/video.mp4' },
  { id: 2, title: 'Klasik Kesim', image_url: '/gallery/1.jpeg' },
  { id: 3, title: 'Sakal Tıraşı', image_url: '/gallery/2.jpeg' },
  { id: 4, title: 'Modern Fade Kesim', image_url: '/gallery/3.jpeg' },
  { id: 5, title: 'Stil & Bakım', image_url: '/gallery/4.jpeg' },
  { id: 6, title: 'Detay Kesim', image_url: '/gallery/5.jpeg' },
];

const isVideoUrl = (url: string) => {
  if (!url) return false;
  const cleanUrl = url.split('?')[0].toLowerCase();
  return cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.webm') || cleanUrl.endsWith('.mov') || cleanUrl.endsWith('.ogg');
};

export default async function Galeri() {
  let mediaList: GalleryItem[] = [];

  try {
    const { data, error } = await supabase
      .from('gallery_images')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      mediaList = data;
    } else {
      mediaList = FALLBACK_MEDIA;
    }
  } catch (err) {
    console.error('Galeri yüklenirken hata oluştu:', err);
    mediaList = FALLBACK_MEDIA;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-bold text-white uppercase tracking-wider mb-4">Galeri</h1>
        <div className="w-20 h-1 bg-gold-500 mx-auto"></div>
        <p className="mt-6 text-gray-400 max-w-2xl mx-auto">Yetmans Barbershop'ta yarattığımız tarz ve kusursuz kesimlerimizden bazı kareler.</p>
      </div>

      <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
        {mediaList.map((media, index) => {
          const isVideo = isVideoUrl(media.image_url);

          return (
            <div
              key={media.id || index}
              className="break-inside-avoid relative group cursor-pointer overflow-hidden rounded-sm border border-gold-500/10 hover:border-gold-500/50 transition-colors bg-dark-900"
            >
              {isVideo ? (
                <video
                  src={media.image_url}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-auto object-cover transform transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <Image
                  src={media.image_url}
                  alt={media.title || `Galeri Görseli ${index + 1}`}
                  width={600}
                  height={800}
                  unoptimized
                  className="w-full h-auto object-cover transform transition-transform duration-500 group-hover:scale-105"
                />
              )}

              {/* Başlık Alanı (Varsa üzerine gelince hafif belirir) */}
              {media.title && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                  <p className="text-white text-sm font-medium tracking-wide drop-shadow-md">
                    {media.title}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
