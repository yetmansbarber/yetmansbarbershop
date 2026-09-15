import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';

export const dynamic = 'force-dynamic';

// GET — Tüm galeri kayıtlarını getir
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('gallery_images')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
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
