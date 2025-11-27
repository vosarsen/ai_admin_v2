-- Migration: Seed Demo Staff
-- Date: 2025-11-27
-- Purpose: Create 3 staff members for demo company (ID 999999)

-- Insert demo staff
INSERT INTO staff (
  company_id,
  yclients_staff_id,
  name,
  specialization,
  rating,
  is_active,
  created_at,
  updated_at
) VALUES
  -- Staff 1: Top Stylist
  (999999, 1, 'Анна Мастер', 'Топ-стилист', 4.9, true, NOW(), NOW()),

  -- Staff 2: Colorist
  (999999, 2, 'Ольга Колорист', 'Колорист', 4.8, true, NOW(), NOW()),

  -- Staff 3: Nail Master
  (999999, 3, 'Мария Нэйл-мастер', 'Мастер маникюра', 4.7, true, NOW(), NOW())

ON CONFLICT (company_id, yclients_staff_id) DO UPDATE SET
  name = EXCLUDED.name,
  specialization = EXCLUDED.specialization,
  rating = EXCLUDED.rating,
  updated_at = NOW();

-- Verify creation
SELECT yclients_staff_id, name, specialization, rating
FROM staff
WHERE company_id = 999999
ORDER BY yclients_staff_id;
