-- Migration: Seed Demo Services
-- Date: 2025-11-27
-- Purpose: Create 6 realistic services for demo company (ID 999999)

-- Insert demo services
INSERT INTO services (
  company_id,
  yclients_id,
  title,
  category_title,
  price_min,
  price_max,
  duration,
  description,
  is_active,
  created_at,
  updated_at
) VALUES
  -- Service 1: Women's Haircut
  (999999, 1, 'Женская стрижка', 'Парикмахерские услуги', 1500, 1500, 60,
   'Стрижка любой сложности + укладка', true, NOW(), NOW()),

  -- Service 2: Hair Coloring
  (999999, 2, 'Окрашивание волос', 'Парикмахерские услуги', 3000, 5000, 180,
   'Окрашивание качественными красителями. Цена зависит от длины волос', true, NOW(), NOW()),

  -- Service 3: Manicure
  (999999, 3, 'Маникюр', 'Ногтевой сервис', 1200, 1200, 60,
   'Аппаратный маникюр с покрытием гель-лак', true, NOW(), NOW()),

  -- Service 4: Pedicure
  (999999, 4, 'Педикюр', 'Ногтевой сервис', 1500, 1500, 90,
   'Аппаратный педикюр с покрытием', true, NOW(), NOW()),

  -- Service 5: Hair Styling
  (999999, 5, 'Укладка', 'Парикмахерские услуги', 800, 800, 45,
   'Укладка на любое событие', true, NOW(), NOW()),

  -- Service 6: Hair Botox
  (999999, 6, 'Ботокс для волос', 'Уход за волосами', 4000, 4000, 120,
   'Восстановление и разглаживание волос', true, NOW(), NOW())

ON CONFLICT (yclients_id, company_id) DO UPDATE SET
  title = EXCLUDED.title,
  price_min = EXCLUDED.price_min,
  price_max = EXCLUDED.price_max,
  duration = EXCLUDED.duration,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Verify creation
SELECT yclients_id, title, category_title, price_min, price_max, duration
FROM services
WHERE company_id = 999999
ORDER BY yclients_id;
