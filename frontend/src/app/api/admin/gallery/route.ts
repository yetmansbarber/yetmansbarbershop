import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const LOCAL_MEDIA_FILES = [
  { file: 'video.mp4', title: 'Tanıtım Videosu', mime: 'video/mp4' },
  { file: '1.jpeg', title: 'Klasik Kesim', mime: 'image/jpeg' },
  { file: '2.jpeg', title: 'Sakal Tıraşı', mime: 'image/jpeg' },
  { file: '3.jpeg', title: 'Modern Fade Kesim', mime: 'image/jpeg' },
  { file: '4.jpeg', title: 'Stil & Bakım', mime: 'image/jpeg' },
  { file: '5.jpeg', title: 'Detay Kesim', mime: 'image/jpeg' },
];

// GET — Tüm galeri kayıtlarını getir (Boşsa yerel dosyaları Storage'a yükleyip DB'ye ekle)
export async function GET(req: NextRequest) {
  try {
    let { data, error } = await supabase
      .from('gallery_images')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Eğer veritabanı henüz tamamen boşsa, yerel dosyaları Storage'a yükle ve DB'ye kaydet
    if (!data || data.length === 0) {
      const galleryDir = path.join(process.cwd(), 'public', 'gallery');
      const origin = req.nextUrl.origin;

      for (const item of LOCAL_MEDIA_FILES) {
        let buffer: Buffer | null = null;
        const filePath = path.join(galleryDir, item.file);

        if (fs.existsSync(filePath)) {
          buffer = fs.readFileSync(filePath);
        } else {
          // Vercel serverless ortamında dosya sistemi yerine HTTP üzerinden statik dosyayı çek
          try {
            const res = await fetch(`${origin}/gallery/${item.file}`);
            if (res.ok) {
              const arrayBuffer = await res.arrayBuffer();
              buffer = Buffer.from(arrayBuffer);
            }
          } catch (fetchErr) {
            console.error(`Dosya çekilemedi (${item.file}):`, fetchErr);
          }
        }

        if (buffer) {
          const storageFileName = `migrated_${item.file}`;

          // Storage'a yükle
          await supabase.storage
            .from('gallery')
            .upload(storageFileName, buffer, {
              contentType: item.mime,
              upsert: true,
            });

          // Public URL al
          const { data: { publicUrl } } = supabase.storage
            .from('gallery')
            .getPublicUrl(storageFileName);

          // Veritabanına yaz
          await supabase.from('gallery_images').insert({
            title: item.title,
            image_url: publicUrl,
          });
        }
      }

      // Ana sayfa için 1.jpeg'i bağımsız olarak 'about-barber.jpeg' adıyla Storage'a yedekle
      let aboutBuffer: Buffer | null = null;
      const aboutFilePath = path.join(galleryDir, '1.jpeg');
      if (fs.existsSync(aboutFilePath)) {
        aboutBuffer = fs.readFileSync(aboutFilePath);
      } else {
        try {
          const res = await fetch(`${origin}/gallery/1.jpeg`);
          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            aboutBuffer = Buffer.from(arrayBuffer);
          }
        } catch {}
      }

      if (aboutBuffer) {
        await supabase.storage
          .from('gallery')
          .upload('about-barber.jpeg', aboutBuffer, {
            contentType: 'image/jpeg',
            upsert: true,
          });
      }

      // Güncellenmiş listeyi yeniden çek
      const refetch = await supabase
        .from('gallery_images')
        .select('*')
        .order('created_at', { ascending: false });
      data = refetch.data || [];
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Hata oluştu' }, { status: 500 });
  }
}

// POST — Yeni görsel veya video yükle
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const directUrl = formData.get('image_url') as string | null;
    const title = (formData.get('title') as string || '').trim();

    let finalMediaUrl = '';

    if (file && file.size > 0) {
      // Dosya boyutu sınırı (Örn: 50 MB)
      if (file.size > 50 * 1024 * 1024) {
        return NextResponse.json({ error: 'Dosya boyutu 50MB sınırını aşamaz.' }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Dosya adını sanitize et ve benzersiz yap
      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${Date.now()}_${cleanName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('gallery')
        .upload(fileName, buffer, {
          contentType: file.type || 'application/octet-stream',
          upsert: true,
        });

      if (uploadError) {
        return NextResponse.json({ error: `Storage yükleme hatası: ${uploadError.message}` }, { status: 500 });
      }

      const { data: { publicUrl } } = supabase.storage
        .from('gallery')
        .getPublicUrl(fileName);

      finalMediaUrl = publicUrl;
    } else if (directUrl && directUrl.trim()) {
      finalMediaUrl = directUrl.trim();
    } else {
      return NextResponse.json({ error: 'Lütfen bir dosya seçin veya bağlantı girin.' }, { status: 400 });
    }

    // Veritabanına kaydet
    const { data: inserted, error: dbError } = await supabase
      .from('gallery_images')
      .insert({
        title: title || null,
        image_url: finalMediaUrl,
      })
      .select('*')
      .single();

    if (dbError) {
      return NextResponse.json({ error: `Veritabanı hatası: ${dbError.message}` }, { status: 500 });
    }

    return NextResponse.json(inserted, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Sunucu hatası.' }, { status: 500 });
  }
}

// DELETE — Görseli sil (Storage'dan ve DB'den)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID belirtilmedi.' }, { status: 400 });
    }

    // Önce kaydı bulalım ki Storage dosya adını çıkarabilelim
    const { data: item, error: findError } = await supabase
      .from('gallery_images')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !item) {
      return NextResponse.json({ error: 'Kayıt bulunamadı.' }, { status: 404 });
    }

    // Eğer URL Supabase Storage'daki gallery bucket'ına aitse oradan da silelim
    if (item.image_url && item.image_url.includes('/storage/v1/object/public/gallery/')) {
      const parts = item.image_url.split('/storage/v1/object/public/gallery/');
      if (parts[1]) {
        const storageFilePath = decodeURIComponent(parts[1]);
        await supabase.storage.from('gallery').remove([storageFilePath]);
      }
    }

    // Veritabanından sil
    const { error: deleteError } = await supabase
      .from('gallery_images')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Sunucu hatası.' }, { status: 500 });
  }
}
