-- ============================================================
-- Migration 002: Staff Auth Bağlantısı
-- Supabase Dashboard → SQL Editor'de çalıştırın
-- ============================================================

-- staff tablosuna auth_user_id ekle
-- Eski staff kayıtları NULL kalır (sorun değil)
ALTER TABLE staff
    ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Ana Berber'in auth_user_id'sini ileride elle veya API ile set edebilirsiniz
-- (zorunlu değil, panel zaten admin rolünü kontrol ediyor)

-- Hızlı erişim için index
CREATE INDEX IF NOT EXISTS idx_staff_auth_user_id ON staff (auth_user_id);

-- user_roles tablosuna 'staff' rolünü kolayca okuyabilmek için policy
-- (Eğer daha önce rbac_schema.sql çalıştırdıysanız zaten var)
-- Sadece güvenli olsun diye tekrar ekliyoruz, hata verse görmezden gelin:
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_roles' AND policyname = 'Users can read own role'
    ) THEN
        CREATE POLICY "Users can read own role"
        ON user_roles FOR SELECT USING (auth.uid() = id);
    END IF;
END $$;

-- ============================================================
-- SONUÇ:
--   ✅ staff.auth_user_id → Supabase Auth user ile bağlantı
--   ✅ Giriş yapan çırak artık kendi staff kaydına ulaşabilir
-- ============================================================
