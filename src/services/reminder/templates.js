// src/services/reminder/templates.js

/**
 * Шаблоны для напоминаний за день (дружелюбные с именем)
 * {service} - винительный падеж (что?)
 * на {service} - предложный падеж с НА
 */
const dayBeforeTemplates = [
  "Добрый вечер, {name}! Напоминаем о записи на {service} завтра в {time} ✨",
  "Приветствую, {name}! Завтра в {time} ждём вас на {service} 🌟",
  "Добрый вечер, {name}! Не забудьте про {service} завтра в {time} ☺️",
  "Здравствуйте, {name}! Завтра в {time} {staff} ждёт вас на {service} ✨",
  "Приветствую, {name}! Напоминаем: завтра в {time} у вас {service} 📝",
  "Добрый вечер, {name}! Всё в силе на завтра? {service} в {time} 🤝",
  "Здравствуйте, {name}! Подтверждаем {service} на завтра в {time} ✅",
  "Приветствую, {name}! {staff} ждёт вас завтра в {time} на {service} 💫",
  "Добрый вечер, {name}! Напоминаем о записи на {service} завтра в {time} 📅",
  "Здравствуйте, {name}! До встречи завтра в {time} на {service} 👋",
  "{name}, добрый вечер! Ждём вас завтра в {time} на {service} ✨",
  "Приветствую вас, {name}! Завтрашняя запись на {service} в {time} подтверждена 🌟",
  "{name}, здравствуйте! Напоминаем: завтра в {time} {service} 📅",
  "Добрый вечер, {name}! {staff} будет рад видеть вас завтра в {time} на {service} 😊",
  "{name}, приветствую! Всё готово для {service} завтра в {time} ✅",
  "Добрый вечер, {name}! Завтра в {time} вас ждёт {service} 🎯",
  "Здравствуйте, {name}! Мастер {staff} готов к {service} завтра в {time} 💼",
  "{name}, напоминаем о завтрашней записи: {service} в {time} 📋",
  "Приветствую, {name}! Ждём вас на {service} завтра в {time} 🕐",
  "Добрый вечер! {name}, завтра в {time} у вас запланирована {service} ⭐"
];

/**
 * Шаблоны для напоминаний за 2 часа (формальные)
 * {service} - винительный падеж (что?)
 * на {service} - предложный падеж с НА
 */
const twoHoursTemplates = [
  "Напоминаем: сегодня в {time} у вас запись на {service}.",
  "Через 2 часа вас ожидает {staff} на {service}. Время визита: {time}.",
  "Добрый день! В {time} мы ждём вас на {service}.",
  "Уважаемый клиент, напоминаем о записи на {service} в {time}.",
  "Через пару часов ({time}) вас ждёт {staff} на {service}.",
  "Напоминание: {service} запланирована на {time} сегодня.",
  "В {time} для вас забронировано время на {service}. {staff} уже готовится.",
  "Ждём вас сегодня в {time} на {service}. Мастер {staff} подготовил всё необходимое.",
  "Ваша запись на {service} через 2 часа ({time}).",
  "Скоро встретимся! {service} в {time}.",
  "Осталось 2 часа до {service} ({time}). {staff} вас ждёт.",
  "Напоминаем о сегодняшней записи на {service} в {time}.",
  "Через 2 часа ({time}) начнётся {service}. Мастер: {staff}.",
  "До встречи в {time}! Всё готово для {service}.",
  "Ваше время сегодня: {time} на {service}. Осталось 2 часа.",
  "Через 2 часа ({time}) вас ждёт {service}. Мастер {staff} готов.",
  "Напоминаем: {service} сегодня в {time}. До встречи!",
  "Добрый день! Осталось 2 часа до записи на {service} в {time}.",
  "В {time} мастер {staff} ждёт вас на {service}.",
  "Скоро увидимся! {service} начнётся в {time}."
];

/**
 * Окончания для напоминаний за день
 */
const dayBeforeEndings = [
  "Если планы изменились - дайте знать 👍",
  "Будут изменения - напишите нам 📝",
  "Если не сможете - предупредите, пожалуйста 🙏",
  "Ждём вас! Если что - пишите 💬",
  "До встречи! Или сообщите, если планы поменялись ✉️",
  "Если нужно перенести - сообщите заранее 📱",
  "Ждём вас! Или напишите, если изменились планы 💌",
  "До завтра! Если что-то поменялось - дайте знать 🤝"
];

/**
 * Окончания для напоминаний за 2 часа
 */
const twoHoursEndings = [
  "До встречи!",
  "Ждём вас!",
  "До скорой встречи!",
  "Увидимся!",
  "Будем рады вас видеть!",
  "Скоро увидимся!",
  "До встречи в салоне!",
  "Ждём вас с нетерпением!"
];

/**
 * Получить случайный элемент из массива
 */
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Заменить плейсхолдеры в шаблоне
 */
function fillTemplate(template, data) {
  let result = template;
  
  // Заменяем плейсхолдеры
  result = result.replace('{name}', data.clientName || 'дорогой клиент');
  result = result.replace('{time}', data.time);
  result = result.replace('{staff}', data.staff);
  
  // Используем склонения для услуг, если есть
  if (data.serviceDeclensions) {
    // Определяем нужный падеж по контексту
    
    // "на {service}" - предложный падеж с предлогом НА
    result = result.replace(/на {service}/g, 
      `на ${data.serviceDeclensions.prepositional_na || data.serviceDeclensions.prepositional || data.service.toLowerCase()}`);
    
    // "о записи на {service}" - предложный падеж с предлогом НА
    result = result.replace(/записи на {service}/g,
      `записи на ${data.serviceDeclensions.prepositional_na || data.serviceDeclensions.prepositional || data.service.toLowerCase()}`);
    
    // "про {service}" - винительный падеж
    result = result.replace(/про {service}/g, 
      `про ${data.serviceDeclensions.accusative || data.service.toLowerCase()}`);
    
    // "для {service}" - родительный падеж
    result = result.replace(/для {service}/g, 
      `для ${data.serviceDeclensions.genitive || data.service.toLowerCase()}`);
    
    // "до {service}" - родительный падеж
    result = result.replace(/до {service}/g, 
      `до ${data.serviceDeclensions.genitive || data.service.toLowerCase()}`);
    
    // "к {service}" - дательный падеж
    result = result.replace(/к {service}/g,
      `к ${data.serviceDeclensions.dative || data.service.toLowerCase()}`);
    
    // "{service} запланирована" или "у вас {service}" - именительный падеж
    result = result.replace(/\{service\} запланирована/g,
      `${data.serviceDeclensions.nominative || data.service.toLowerCase()} запланирована`);
    
    result = result.replace(/у вас {service}/g,
      `у вас ${data.serviceDeclensions.nominative || data.service.toLowerCase()}`);
    
    result = result.replace(/вас ждёт {service}/g,
      `вас ждёт ${data.serviceDeclensions.nominative || data.service.toLowerCase()}`);
    
    result = result.replace(/начнётся {service}/g,
      `начнётся ${data.serviceDeclensions.nominative || data.service.toLowerCase()}`);
    
    result = result.replace(/у вас запланирована {service}/g,
      `у вас запланирована ${data.serviceDeclensions.nominative || data.service.toLowerCase()}`);
    
    // Оставшиеся {service} без предлогов - обычно именительный или винительный
    result = result.replace(/{service}/g, 
      data.serviceDeclensions.nominative || data.service.toLowerCase());
      
  } else {
    // Если склонений нет, используем название как есть, но в нижнем регистре
    result = result.replace(/{service}/g, data.service.toLowerCase());
  }
  
  return result;
}

/**
 * Сгенерировать напоминание за день
 */
function generateDayBeforeReminder(data) {
  const template = getRandomElement(dayBeforeTemplates);
  const ending = getRandomElement(dayBeforeEndings);
  
  const mainText = fillTemplate(template, data);
  
  // Собираем полное сообщение
  let message = mainText + '\n\n';
  
  // Добавляем детали только если их нет в основном тексте
  message += `Мастер: ${data.staff}\n`;
  if (data.price > 0) {
    message += `Стоимость: ${data.price} руб.\n`;
  }
  if (data.address) {
    message += `\nЖдём вас по адресу: ${data.address}\n`;
  }
  message += '\n' + ending;
  
  return message;
}

/**
 * Сгенерировать напоминание за 2 часа
 */
function generateTwoHoursReminder(data) {
  const template = getRandomElement(twoHoursTemplates);
  const ending = getRandomElement(twoHoursEndings);
  
  const mainText = fillTemplate(template, data);
  
  // Собираем полное сообщение
  let message = mainText + '\n';
  if (data.address) {
    message += `Адрес: ${data.address}\n`;
  }
  message += '\n' + ending;
  
  return message;
}

module.exports = {
  generateDayBeforeReminder,
  generateTwoHoursReminder
};