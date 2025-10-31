-- Добавление колонки для склонений имен мастеров
ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS declensions jsonb;

-- Примеры склонений для существующих мастеров
UPDATE staff SET declensions = '{
  "nominative": "Бари",
  "genitive": "Бари",
  "dative": "Бари",
  "accusative": "Бари",
  "instrumental": "Бари",
  "prepositional": "Бари",
  "prepositional_u": "у Бари"
}'::jsonb WHERE name = 'Бари';

UPDATE staff SET declensions = '{
  "nominative": "Сергей",
  "genitive": "Сергея",
  "dative": "Сергею",
  "accusative": "Сергея",
  "instrumental": "Сергеем",
  "prepositional": "Сергее",
  "prepositional_u": "у Сергея"
}'::jsonb WHERE name = 'Сергей';

UPDATE staff SET declensions = '{
  "nominative": "Рамзан",
  "genitive": "Рамзана",
  "dative": "Рамзану",
  "accusative": "Рамзана",
  "instrumental": "Рамзаном",
  "prepositional": "Рамзане",
  "prepositional_u": "у Рамзана"
}'::jsonb WHERE name = 'Рамзан';

UPDATE staff SET declensions = '{
  "nominative": "Дарья",
  "genitive": "Дарьи",
  "dative": "Дарье",
  "accusative": "Дарью",
  "instrumental": "Дарьей",
  "prepositional": "Дарье",
  "prepositional_u": "у Дарьи"
}'::jsonb WHERE name = 'Дарья';

UPDATE staff SET declensions = '{
  "nominative": "Богдан",
  "genitive": "Богдана",
  "dative": "Богдану",
  "accusative": "Богдана",
  "instrumental": "Богданом",
  "prepositional": "Богдане",
  "prepositional_u": "у Богдана"
}'::jsonb WHERE name = 'Богдан';

UPDATE staff SET declensions = '{
  "nominative": "Никита",
  "genitive": "Никиты",
  "dative": "Никите",
  "accusative": "Никиту",
  "instrumental": "Никитой",
  "prepositional": "Никите",
  "prepositional_u": "у Никиты"
}'::jsonb WHERE name = 'Никита';

UPDATE staff SET declensions = '{
  "nominative": "Али",
  "genitive": "Али",
  "dative": "Али",
  "accusative": "Али",
  "instrumental": "Али",
  "prepositional": "Али",
  "prepositional_u": "у Али"
}'::jsonb WHERE name = 'Али';

UPDATE staff SET declensions = '{
  "nominative": "Рауф",
  "genitive": "Рауфа",
  "dative": "Рауфу",
  "accusative": "Рауфа",
  "instrumental": "Рауфом",
  "prepositional": "Рауфе",
  "prepositional_u": "у Рауфа"
}'::jsonb WHERE name = 'Рауф';

UPDATE staff SET declensions = '{
  "nominative": "Ашот",
  "genitive": "Ашота",
  "dative": "Ашоту",
  "accusative": "Ашота",
  "instrumental": "Ашотом",
  "prepositional": "Ашоте",
  "prepositional_u": "у Ашота"
}'::jsonb WHERE name = 'Ашот';

UPDATE staff SET declensions = '{
  "nominative": "Мелисса",
  "genitive": "Мелиссы",
  "dative": "Мелиссе",
  "accusative": "Мелиссу",
  "instrumental": "Мелиссой",
  "prepositional": "Мелиссе",
  "prepositional_u": "у Мелиссы"
}'::jsonb WHERE name = 'Мелисса';

UPDATE staff SET declensions = '{
  "nominative": "Ален Эрнандес",
  "genitive": "Алена Эрнандеса",
  "dative": "Алену Эрнандесу",
  "accusative": "Алена Эрнандеса",
  "instrumental": "Аленом Эрнандесом",
  "prepositional": "Алене Эрнандесе",
  "prepositional_u": "у Алена Эрнандеса"
}'::jsonb WHERE name = 'Ален Эрнандес';