// src/services/reminder/templates.js

/**
 * Шаблоны для напоминаний за день (дружелюбные с именем)
 */
const dayBeforeTemplates = [
  "Добрый вечер, {name}! Напоминаем о вашей записи завтра в {time} ✨",
  "Приветствую, {name}! Завтра в {time} ждём вас на {service} 🌟",
  "Добрый вечер, {name}! Не забудьте про завтрашнюю запись в {time} ☺️",
  "Здравствуйте, {name}! Завтра в {time} вас ждёт {staff} ✨",
  "Приветствую, {name}! Напоминаем: завтра в {time} у вас {service} 📝",
  "Добрый вечер, {name}! Всё в силе на завтра, {time}? 🤝",
  "Здравствуйте, {name}! Подтверждаем вашу запись на завтра в {time} ✅",
  "Приветствую, {name}! {staff} ждёт вас завтра в {time} 💫",
  "Добрый вечер, {name}! Напоминаем о визите завтра в {time} 📅",
  "Здравствуйте, {name}! До встречи завтра в {time} на {service} 👋",
  "{name}, добрый вечер! Ждём вас завтра в {time} ✨",
  "Приветствую вас, {name}! Завтрашняя запись в {time} подтверждена 🌟",
  "{name}, здравствуйте! Напоминаем о записи завтра в {time} 📅",
  "Добрый вечер, {name}! {staff} будет рад видеть вас завтра в {time} 😊",
  "{name}, приветствую! Всё готово для вашего визита завтра в {time} ✅"
];

/**
 * Шаблоны для напоминаний за 2 часа (формальные)
 */
const twoHoursTemplates = [
  "Напоминаем: сегодня в {time} у вас запись на {service}.",
  "Через 2 часа вас ожидает {staff}. Время визита: {time}.",
  "Добрый день! В {time} мы ждём вас на {service}.",
  "Уважаемый клиент, напоминаем о записи в {time}.",
  "Через пару часов ({time}) вас ждёт {staff}.",
  "Напоминание: ваш визит запланирован на {time} сегодня.",
  "В {time} для вас забронировано время. {staff} уже готовится.",
  "Ждём вас сегодня в {time}. Мастер {staff} подготовил всё необходимое.",
  "Ваша запись на {service} через 2 часа ({time}).",
  "Скоро встретимся! Ваш визит в {time}.",
  "Осталось 2 часа до вашей записи ({time}). {staff} вас ждёт.",
  "Напоминаем о сегодняшнем визите в {time}.",
  "Через 2 часа ({time}) начнётся ваш сеанс. Мастер: {staff}.",
  "До встречи в {time}! Всё готово для вашего визита.",
  "Ваше время сегодня: {time}. Осталось 2 часа."
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
  
  // Используем склонения для услуг, если есть
  if (data.serviceDeclensions) {
    // Для шаблонов с "на {service}" используем prepositional_na (предложный с НА)
    if (template.includes('на {service}')) {
      result = result.replace('на {service}', 
        `на ${data.serviceDeclensions.prepositional_na || data.service}`);
    }
    // Для остальных случаев используем винительный падеж (accusative)
    else {
      result = result.replace('{service}', 
        data.serviceDeclensions.accusative || data.service);
    }
  } else {
    result = result.replace('{service}', data.service);
  }
  
  result = result.replace('{staff}', data.staff);
  
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
  message += `${data.service}\n`;
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