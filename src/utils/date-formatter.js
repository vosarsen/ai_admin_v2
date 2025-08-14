/**
 * Утилиты для человечного форматирования дат
 */

const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 
                'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

/**
 * Форматирует дату в человечный вид с днем недели
 * @param {Date|string} date - дата для форматирования
 * @param {boolean} includeYear - включать ли год
 * @returns {string} - форматированная дата
 */
function formatHumanDate(date, includeYear = false) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfterTomorrow = new Date(today);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
  
  // Сравниваем только даты, без времени
  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const tomorrowOnly = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
  const dayAfterOnly = new Date(dayAfterTomorrow.getFullYear(), dayAfterTomorrow.getMonth(), dayAfterTomorrow.getDate());
  
  // Относительные даты
  if (dateOnly.getTime() === todayOnly.getTime()) {
    return 'сегодня';
  }
  if (dateOnly.getTime() === tomorrowOnly.getTime()) {
    return 'завтра';
  }
  if (dateOnly.getTime() === dayAfterOnly.getTime()) {
    return 'послезавтра';
  }
  
  // Для дат в пределах недели - показываем день недели
  const daysDiff = Math.floor((dateOnly - todayOnly) / (1000 * 60 * 60 * 24));
  if (daysDiff > 0 && daysDiff <= 7) {
    const weekday = WEEKDAYS[d.getDay()];
    const day = d.getDate();
    const month = MONTHS[d.getMonth()];
    return `${weekday}, ${day} ${month}`;
  }
  
  // Для остальных дат - обычный формат
  const day = d.getDate();
  const month = MONTHS[d.getMonth()];
  const year = includeYear && d.getFullYear() !== today.getFullYear() ? ` ${d.getFullYear()}` : '';
  const weekday = daysDiff <= 14 ? `${WEEKDAYS[d.getDay()]}, ` : '';
  
  return `${weekday}${day} ${month}${year}`;
}

/**
 * Форматирует список дат для отображения рабочих дней
 * @param {Array<string>} dates - массив дат в формате YYYY-MM-DD или уже форматированных
 * @param {number} maxDisplay - максимальное количество дат для показа
 * @returns {string} - форматированная строка с датами
 */
function formatWorkingDays(dates, maxDisplay = 5) {
  if (!dates || dates.length === 0) {
    return 'не указаны';
  }
  
  // Форматируем каждую дату
  const formattedDates = dates.map(date => {
    // Если дата уже форматирована (содержит буквы), оставляем как есть
    if (/[а-яА-Я]/.test(date)) {
      return date;
    }
    // Иначе форматируем
    return formatHumanDate(date);
  });
  
  // Берем первые N дат
  const displayDates = formattedDates.slice(0, maxDisplay);
  let result = displayDates.join(', ');
  
  // Добавляем информацию об остальных днях
  if (formattedDates.length > maxDisplay) {
    const remaining = formattedDates.length - maxDisplay;
    result += ` и еще ${remaining} ${getDayWord(remaining)}`;
  }
  
  return result;
}

/**
 * Склонение слова "день"
 * @param {number} count - количество дней
 * @returns {string} - правильная форма слова
 */
function getDayWord(count) {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return 'дней';
  }
  
  if (lastDigit === 1) {
    return 'день';
  }
  
  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'дня';
  }
  
  return 'дней';
}

/**
 * Форматирует дату и время в человечный вид
 * @param {Date|string} datetime - дата и время
 * @returns {string} - форматированная строка
 */
function formatHumanDateTime(datetime) {
  const d = typeof datetime === 'string' ? new Date(datetime) : datetime;
  const date = formatHumanDate(d);
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  
  // Для относительных дат (сегодня, завтра) не добавляем "в"
  if (date === 'сегодня' || date === 'завтра' || date === 'послезавтра') {
    return `${date} в ${hours}:${minutes}`;
  }
  
  return `${date} в ${hours}:${minutes}`;
}

module.exports = {
  formatHumanDate,
  formatWorkingDays,
  formatHumanDateTime,
  getDayWord,
  WEEKDAYS,
  MONTHS
};