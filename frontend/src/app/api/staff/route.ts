import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/utils/supabase-admin';
import { createClient } from '@/utils/supabase/server';

// GET /api/staff — Tüm aktif personeli listele (public — randevu dropdown için)
export async function GET() {
  const { data, error } = await supabase
    .from('staff')
    .select('id, name, role, is_active, auth_user_id')
    .eq('is_active', true)
    .order('id', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/staff — Yeni personel ekle + Supabase Auth user oluştur
export async function POST(request: Request) {
  const supabaseServer = await createClient();
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { name, role, email, password } = body;

  if (!name) return NextResponse.json({ error: 'İsim zorunludur.' }, { status: 400 });

  let authUserId: string | null = null;

  // Email + şifre verilmişse Supabase'de auth user oluştur
  if (email && password) {
    if (password.length < 6) {
      return NextResponse.json({ error: 'Şifre en az 6 karakter olmalıdır.' }, { status: 400 });
    }

    // Supabase Admin API ile auth user oluştur (email doğrulama gerekmez)
    const { data: newAuthUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Onay maili göndermeden direkt aktif et
    });

    if (authError) {
      // Zaten kayıtlı email gibi durumları yakala
      return NextResponse.json(
        { error: 'Auth hatası: ' + authError.message },
        { status: 400 }
      );
    }

    authUserId = newAuthUser.user.id;

    // user_roles tablosuna 'staff' rolü ekle (login sonrası /panel'e yönlendirir)
    await supabase
      .from('user_roles')
      .insert([{ id: authUserId, role: 'staff' }]);
  }

  // staff tablosuna kaydet (auth_user_id varsa bağla)
  const { data: newStaff, error: staffError } = await supabase
    .from('staff')
    .insert([{
      name,
      role: role || 'barber',
      is_active: true,
      ...(authUserId ? { auth_user_id: authUserId } : {}),
    }])
    .select()
    .single();

  if (staffError) {
    // Eğer staff oluşturulamazsa auth user'ı da sil (rollback)
    if (authUserId) {
      await supabase.auth.admin.deleteUser(authUserId);
    }
    return NextResponse.json({ error: staffError.message }, { status: 500 });
  }

  return NextResponse.json(newStaff, { status: 201 });
}

// PATCH /api/staff — Personel güncelle (is_active false → soft delete)
export async function PATCH(request: Request) {
  const supabaseServer = await createClient();
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { id, name, role, is_active } = body;
  if (!id) return NextResponse.json({ error: 'ID zorunludur.' }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (role !== undefined) updates.role = role;
  if (is_active !== undefined) updates.is_active = is_active;

  const { data, error } = await supabase
    .from('staff')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/staff?id=X — Personeli ve auth user'ı tamamen sil
export async function DELETE(request: Request) {
  const supabaseServer = await createClient();
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID zorunludur.' }, { status: 400 });

  // Önce staff kaydını al (auth_user_id'yi almak için)
  const { data: staffRecord } = await supabase
    .from('staff')
    .select('id, auth_user_id')
    .eq('id', id)
    .single();

  if (!staffRecord) return NextResponse.json({ error: 'Personel bulunamadı.' }, { status: 404 });
  if (staffRecord.id === 1) return NextResponse.json({ error: 'Ana Berber silinemez.' }, { status: 403 });

  // Soft delete (is_active = false) — randevu geçmişi korunur
  await supabase.from('staff').update({ is_active: false }).eq('id', id);

  // Eğer auth user varsa onu da devre dışı bırak (tamamen silmek için .deleteUser kullanılabilir)
  if (staffRecord.auth_user_id) {
    await supabase.auth.admin.updateUserById(staffRecord.auth_user_id, {
      ban_duration: '87600h', // 10 yıl = devre dışı
    });
  }

  return NextResponse.json({ success: true });
}
