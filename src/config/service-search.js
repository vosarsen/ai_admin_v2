/**
 * Конфигурация для поиска услуг
 * Определяет паттерны и правила для категоризации услуг
 */

module.exports = {
  // Паттерны для определения категорий услуг
  categoryPatterns: {
    children: {
      keywords: ['детск', 'ребен', 'сын', 'дочь', 'школьник'],
      categoryName: 'детские услуги'
    },
    haircuts: {
      keywords: ['стриж'],
      categoryName: 'стрижки'
    },
    beard: {
      keywords: ['бород', 'усы'],
      categoryName: 'борода и усы'
    },
    coloring: {
      keywords: ['окраш', 'тонир', 'колор'],
      categoryName: 'окрашивание'
    },
    care: {
      keywords: ['уход', 'spa', 'массаж головы'],
      categoryName: 'уход'
    },
    manicure: {
      keywords: ['маникюр', 'ногт', 'педикюр'],
      categoryName: 'маникюр и педикюр'
    },
    eyebrows: {
      keywords: ['бров'],
      categoryName: 'брови'
    },
    waxing: {
      keywords: ['воск', 'эпил', 'депил', 'шугар'],
      categoryName: 'эпиляция'
    }
  },

  // Настройки для fuzzy matching
  fuzzyMatchConfig: {
    threshold: 0.10,
    limit: 30,
    keys: ['title']
  },

  // Приоритет категорий (для случаев когда несколько паттернов совпадают)
  categoryPriority: [
    'children',
    'haircuts',
    'beard',
    'coloring',
    'manicure',
    'eyebrows',
    'waxing',
    'care'
  ]
};