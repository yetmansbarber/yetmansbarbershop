import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';

export const dynamic = 'force-dynamic';

// GET — Tüm hizmetleri listele (pasifler dahil)
export async function GET() {
  const { data, error } = await supabase
    .from('services')
    .select('id, name, price, duration_minutes')
    .order('id', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST — Yeni hizmet ekle
export async function POST(req: NextRequest) {
  let body: { name?: string; price?: number; duration_minutes?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Gecersiz JSON.' }, { status: 400 });
  }

  const name = (body.name ?? '').trim();
  const price = Number(body.price);
  const duration_minutes = Number(body.duration_minutes) || 30;

  if (!name) {
    return NextResponse.json({ error: 'Hizmet adi bos olamaz.' }, { status: 400 });
  }
  if (isNaN(price) || price < 0) {
    return NextResponse.json({ error: 'Gecersiz fiyat.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('services')
    .insert({ name, price, duration_minutes })
    .select('id, name, price, duration_minutes')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

// PATCH — Mevcut hizmeti guncelle
export async function PATCH(req: NextRequest) {
  let body: { id?: number; name?: string; price?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Gecersiz JSON.' }, { status: 400 });
  }

  const id = Number(body.id);
  const name = (body.name ?? '').trim();
  const price = Number(body.price);

  if (!id) {
    return NextResponse.json({ error: 'Hizmet ID gerekli.' }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: 'Hizmet adi bos olamaz.' }, { status: 400 });
  }
  if (isNaN(price) || price < 0) {
    return NextResponse.json({ error: 'Gecersiz fiyat.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('services')
    .update({ name, price })
    .eq('id', id)
    .select('id, name, price, duration_minutes')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Hizmet bulunamadi.' }, { status: 404 });
  }

  return NextResponse.json(data);
}

// DELETE — Pasife al (price=0) veya kalici sil (?mode=delete)
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get('id'));
  const mode = searchParams.get('mode') ?? 'deactivate';

  if (!id) {
    return NextResponse.json({ error: 'Hizmet ID gerekli.' }, { status: 400 });
  }

  if (mode === 'delete') {
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, action: 'deleted' });
  }

  const { data, error } = await supabase
    .from('services')
    .update({ price: 0 })
    .eq('id', id)
    .select('id, name, price')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, action: 'deactivated', data });
}
