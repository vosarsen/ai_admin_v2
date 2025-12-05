const crypto = require('crypto');
const logger = require('./logger').child({ module: 'ics-generator' });

class ICSGenerator {
  /**
   * Генерация .ics файла для записи
   * @param {Object} booking - Данные записи
   * @param {string} companyName - Название компании
   * @returns {string} - Содержимое .ics файла
   */
  generateBookingICS(booking, companyName = 'Салон красоты') {
    const { datetime, service_name, staff_name, address, record_id } = booking;
    
    // Парсим дату и время
    const [dateStr, timeStr] = datetime.split(' ');
    const [year, month, day] = dateStr.split('-');
    const [hour, minute] = timeStr.split(':');
    
    // Создаем объекты Date для начала и конца события
    const startDate = new Date(year, month - 1, day, hour, minute);
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1); // По умолчанию 1 час
    
    // Форматируем даты для .ics (YYYYMMDDTHHMMSS)
    const formatDate = (date) => {
      const pad = (n) => n.toString().padStart(2, '0');
      return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
    };
    
    // Генерируем уникальный ID для события
    const uid = crypto.randomBytes(16).toString('hex') + '@ai-admin';
    
    // Собираем заголовок события
    let summary = service_name || 'Запись в салон';
    if (staff_name) {
      summary += ` (${staff_name})`;
    }
    
    // Собираем описание
    let description = `Запись в ${companyName}\\n`;
    if (service_name) description += `Услуга: ${service_name}\\n`;
    if (staff_name) description += `Мастер: ${staff_name}\\n`;
    if (record_id) description += `Номер записи: ${record_id}\\n`;
    description += '\\nЕсли планы изменятся, пожалуйста, предупредите заранее.';
    
    // Генерируем .ics файл
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Admin AI//Beauty Salon Booking//RU',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      'BEGIN:VTIMEZONE',
      'TZID:Europe/Moscow',
      'BEGIN:STANDARD',
      'DTSTART:20070101T000000',
      'TZOFFSETFROM:+0300',
      'TZOFFSETTO:+0300',
      'END:STANDARD',
      'END:VTIMEZONE',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${formatDate(new Date())}Z`,
      `DTSTART;TZID=Europe/Moscow:${formatDate(startDate)}`,
      `DTEND;TZID=Europe/Moscow:${formatDate(endDate)}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      address ? `LOCATION:${address}` : '',
      'STATUS:CONFIRMED',
      'SEQUENCE:0',
      'BEGIN:VALARM',
      'TRIGGER:-PT2H',
      'ACTION:DISPLAY',
      'DESCRIPTION:Напоминание о записи через 2 часа',
      'END:VALARM',
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      'DESCRIPTION:Напоминание о записи завтра',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].filter(line => line).join('\r\n');
    
    logger.info('Generated ICS file for booking', {
      record_id,
      summary,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate)
    });
    
    return icsContent;
  }
  
  /**
   * Генерация имени файла для .ics
   * @param {Object} booking - Данные записи
   * @returns {string} - Имя файла
   */
  generateFileName(booking) {
    const { datetime, service_name } = booking;
    const [dateStr] = datetime.split(' ');
    
    // Создаем безопасное имя файла
    let fileName = `booking_${dateStr}`;
    if (service_name) {
      // Транслитерация и очистка имени услуги
      const cleanServiceName = this._transliterate(service_name)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 30);
      fileName += `_${cleanServiceName}`;
    }
    fileName += '.ics';
    
    return fileName;
  }
  
  /**
   * Простая транслитерация для имен файлов
   */
  _transliterate(str) {
    const ru = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd',
      'е': 'e', 'ё': 'yo', 'ж': 'zh', 'з': 'z', 'и': 'i',
      'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n',
      'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't',
      'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch',
      'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '',
      'э': 'e', 'ю': 'yu', 'я': 'ya'
    };
    
    return str.split('').map(char => ru[char.toLowerCase()] || char).join('');
  }
}

module.exports = new ICSGenerator();