/**
 * Простой fuzzy matching для поиска услуг
 * Не требует внешних библиотек
 */

class FuzzyMatcher {
  /**
   * Вычисляет расстояние Левенштейна между двумя строками
   */
  static levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    
    if (m === 0) return n;
    if (n === 0) return m;
    
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(
            dp[i - 1][j],     // удаление
            dp[i][j - 1],     // вставка
            dp[i - 1][j - 1]  // замена
          );
        }
      }
    }
    
    return dp[m][n];
  }
  
  /**
   * Вычисляет схожесть между двумя строками (0-1)
   */
  static similarity(str1, str2) {
    const distance = this.levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
    const maxLength = Math.max(str1.length, str2.length);
    
    if (maxLength === 0) return 1;
    return 1 - (distance / maxLength);
  }
  
  /**
   * Проверяет, содержит ли строка все символы искомого слова в правильном порядке
   */
  static fuzzyContains(text, pattern) {
    const textLower = text.toLowerCase();
    const patternLower = pattern.toLowerCase();
    
    let patternIndex = 0;
    for (let i = 0; i < textLower.length && patternIndex < patternLower.length; i++) {
      if (textLower[i] === patternLower[patternIndex]) {
        patternIndex++;
      }
    }
    
    return patternIndex === patternLower.length;
  }
  
  /**
   * Ищет лучшие совпадения в массиве услуг
   */
  static findBestMatches(query, items, options = {}) {
    const {
      keys = ['title', 'category_title'],
      threshold = 0.3,
      limit = 10
    } = options;
    
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
    
    // Оцениваем каждый элемент
    const scored = items.map(item => {
      let maxScore = 0;
      
      for (const key of keys) {
        const value = item[key];
        if (!value) continue;
        
        const valueLower = value.toLowerCase();
        
        // 1. Точное совпадение = максимальный балл
        if (valueLower === queryLower) {
          maxScore = Math.max(maxScore, 1);
          continue;
        }
        
        // 2. Содержит полный запрос
        if (valueLower.includes(queryLower)) {
          maxScore = Math.max(maxScore, 0.9);
          continue;
        }
        
        // 3. Начинается с запроса
        if (valueLower.startsWith(queryLower)) {
          maxScore = Math.max(maxScore, 0.85);
          continue;
        }
        
        // 4. Содержит все слова из запроса
        const containsAllWords = queryWords.every(word => valueLower.includes(word));
        if (containsAllWords) {
          maxScore = Math.max(maxScore, 0.7);
          continue;
        }
        
        // 5. Fuzzy contains (все символы в правильном порядке)
        if (this.fuzzyContains(valueLower, queryLower)) {
          maxScore = Math.max(maxScore, 0.6);
          continue;
        }
        
        // 6. Содержит хотя бы одно слово из запроса
        const containsSomeWords = queryWords.some(word => valueLower.includes(word));
        if (containsSomeWords) {
          const matchedWords = queryWords.filter(word => valueLower.includes(word)).length;
          const wordScore = 0.4 * (matchedWords / queryWords.length);
          maxScore = Math.max(maxScore, wordScore);
          continue;
        }
        
        // 7. Расстояние Левенштейна для коротких строк
        if (queryLower.length <= 10) {
          const similarity = this.similarity(valueLower, queryLower);
          maxScore = Math.max(maxScore, similarity * 0.5);
        }
      }
      
      return { item, score: maxScore };
    });
    
    // Фильтруем по порогу и сортируем по убыванию рейтинга
    return scored
      .filter(s => s.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.item);
  }
  
  /**
   * Извлекает ключевые слова из запроса для поиска
   */
  static extractKeywords(query) {
    // Удаляем стоп-слова
    const stopWords = [
      'хочу', 'хотел', 'хотела', 'можно', 'нужно', 'надо',
      'сделать', 'делать', 'записаться', 'запись',
      'на', 'в', 'у', 'к', 'с', 'по', 'для', 'или', 'и',
      'мне', 'меня', 'мой', 'моя', 'мое', 'какие', 'какой',
      'есть', 'ли', 'бы', 'что', 'это', 'все', 'вас', 'вам'
    ];
    
    const words = query.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word));
    
    return words;
  }
}

module.exports = FuzzyMatcher;