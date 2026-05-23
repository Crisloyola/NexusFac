-- Ampliar constraint de tipo en comprobantes para incluir Nota de Crédito (07)
-- Ejecutar en: Supabase Dashboard > SQL Editor

ALTER TABLE public.comprobantes
  DROP CONSTRAINT IF EXISTS comprobantes_tipo_check,
  ADD CONSTRAINT comprobantes_tipo_check
    CHECK (tipo IN ('01', '03', '07'));
