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
  "Здравствуйте, {name}! Через 2 часа {staff} будет ждать Вас на {service}. Время визита: {time}.",
  "Добрый день, {name}! Напоминаем, что в {time} ждём вас на {service}.",
  "{name}, здравствуйте! Напоминаем о записи на {service} в {time} у {staff}.",
  "Здравствуйте, {staff}! Через пару часов ({time}) ждём Вас на {service} у {staff}.",
  "Дружеское напоминание: {service} запланирована на {time} сегодня.",
  "Здравствуйте, {name}! В {time} ждём Вас на {service}. {staff} уже готовится к Вашему приходу.",
  "Приветствую Вас, {name}! Ждём вас сегодня в {time} на {service}. Мастер {staff} подготовил всё необходимое и ждёт Вас .",
  "Здравствуйте, {name}! Дружеское напоминание: Ваша запись на {service} через 2 часа ({time}).",
  "Здравствуйте, {name}! Скоро встретимся! Напоминаем, что {service} в {time}.",
  "Здравствуйте, {name}! Осталось 2 часа до {service} ({time}). {staff} вас ждёт.",
  "Здравствуйте, {name}! Напоминаем о сегодняшней записи на {service} в {time}.",
  "Здравствуйте, {name}! Через 2 часа ({time}) ожидаем Вас на {service}. Мастер: {staff}.",
  "Здравствуйте, {name}! До встречи в {time}. Всё готово для Вашему визиту.",
  "Здравствуйте, {name}! Напоминаем, что ожидаем Вас на {service} в {time}. Осталось 2 часа.",
  "Здравствуйте, {name}! Через 2 часа ({time}) вас ждёт {service}. Мастер {staff} готов.",
  "Здравствуйте, {name}! Напоминаем: {service} сегодня в {time}. До встречи!",
  "Добрый день! Осталось 2 часа до записи на {service} в {time}.",
  "Здравствуйте, {name}! В {time} мастер {staff} ждёт вас на {service}.",
  "Здравствуйте, {name}! Скоро увидимся :)  {service} начнётся в {time}."
];

/**
 * Окончания для напоминаний за день
 */
const dayBeforeEndings = [
  "Если планы изменились - пожалуйста, дайте знать 👍",
  "Будут изменения - напишите нам обязательно 📝",
  "Если не сможете - предупредите, пожалуйста 🙏",
  "Ждём вас! Если что - пишите!",
  "До встречи! Обязательно сообщите нам, если планы поменялись ✉️",
  "Если нужно перенести - сообщите пожалуйста заранее 📱",
  "Ждём вас! Если вдруг изменились планы, пожалуйста, сообщите нам об этом 💌",
  "Если что-то поменялось - дайте знать 🤝"
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
 * Форматировать список услуг с правильными склонениями
 * @param {Array} services - массив услуг с declensions
 * @param {String} caseType - падеж (prepositional_na, accusative, nominative и т.д.)
 * @returns {String} отформатированный список услуг
 */
function formatServicesInCase(services, caseType) {
  if (!services || services.length === 0) {
    return 'услугу';
  }

  // Если одна услуга - возвращаем ее в нужном падеже
  if (services.length === 1) {
    const service = services[0];
    if (service.declensions && service.declensions[caseType]) {
      return service.declensions[caseType];
    }
    // Если нет склонений, возвращаем название в нижнем регистре
    return service.title.toLowerCase();
  }

  // Если несколько услуг - форматируем через запятую с "и" перед последней
  const formattedServices = services.map(service => {
    if (service.declensions && service.declensions[caseType]) {
      return service.declensions[caseType];
    }
    return service.title.toLowerCase();
  });

  // Соединяем через запятую, добавляя "и" перед последним элементом
  if (formattedServices.length === 2) {
    // Для двух услуг: "стрижку и моделирование бороды"
    return `${formattedServices[0]} и ${formattedServices[1]}`;
  } else {
    // Для трёх и более: "стрижку, моделирование бороды, укладку и воск"
    const allButLast = formattedServices.slice(0, -1).join(', ');
    const last = formattedServices[formattedServices.length - 1];
    return `${allButLast} и ${last}`;
  }
}

/**
 * Заменить плейсхолдеры в шаблоне
 */
function fillTemplate(template, data) {
  let result = template;

  // Заменяем плейсхолдеры
  result = result.replace(/{name}/g, data.clientName || 'дорогой клиент');
  result = result.replace(/{time}/g, data.time);

  // Обрабатываем склонения мастера
  if (data.staffDeclensions) {
    // "у {staff}" - используем prepositional_u (у Сергея, у Али)
    result = result.replace(/у {staff}/g,
      data.staffDeclensions.prepositional_u || `у ${data.staff}`);

    // "Мастер {staff}" - именительный падеж
    result = result.replace(/[Мм]астер {staff}/g,
      `мастер ${data.staffDeclensions.nominative || data.staff}`);

    // Остальные {staff} - именительный падеж
    result = result.replace(/{staff}/g,
      data.staffDeclensions.nominative || data.staff);
  } else {
    // Если склонений нет, используем имя как есть
    result = result.replace(/{staff}/g, data.staff);
  }

  // НОВАЯ ЛОГИКА: Используем массив услуг со склонениями
  const services = data.servicesWithDeclensions || [];

  if (services.length > 0) {
    // Определяем нужный падеж по контексту и используем formatServicesInCase

    // "на {service}" - предложный падеж с предлогом НА (винительный падеж)
    result = result.replace(/на {service}/g,
      `на ${formatServicesInCase(services, 'prepositional_na')}`);

    // "о записи на {service}" - предложный падеж с предлогом НА
    result = result.replace(/записи на {service}/g,
      `записи на ${formatServicesInCase(services, 'prepositional_na')}`);

    // "про {service}" - винительный падеж
    result = result.replace(/про {service}/g,
      `про ${formatServicesInCase(services, 'accusative')}`);

    // "для {service}" - родительный падеж
    result = result.replace(/для {service}/g,
      `для ${formatServicesInCase(services, 'genitive')}`);

    // "до {service}" - родительный падеж
    result = result.replace(/до {service}/g,
      `до ${formatServicesInCase(services, 'genitive')}`);

    // "к {service}" - дательный падеж
    result = result.replace(/к {service}/g,
      `к ${formatServicesInCase(services, 'dative')}`);

    // "{service} запланирована" или "у вас {service}" - именительный падеж
    result = result.replace(/\{service\} запланирована/g,
      `${formatServicesInCase(services, 'nominative')} запланирована`);

    result = result.replace(/у вас {service}/g,
      `у вас ${formatServicesInCase(services, 'nominative')}`);

    result = result.replace(/вас ждёт {service}/g,
      `вас ждёт ${formatServicesInCase(services, 'nominative')}`);

    result = result.replace(/начнётся {service}/g,
      `начнётся ${formatServicesInCase(services, 'nominative')}`);

    result = result.replace(/у вас запланирована {service}/g,
      `у вас запланирована ${formatServicesInCase(services, 'nominative')}`);

    // Оставшиеся {service} без предлогов - обычно именительный или винительный
    result = result.replace(/{service}/g,
      formatServicesInCase(services, 'nominative'));

  } else {
    // Фоллбэк на старую логику если нет массива услуг
    if (data.serviceDeclensions) {
      result = result.replace(/на {service}/g,
        `на ${data.serviceDeclensions.prepositional_na || data.serviceDeclensions.prepositional || data.service.toLowerCase()}`);
      result = result.replace(/{service}/g,
        data.serviceDeclensions.nominative || data.service.toLowerCase());
    } else {
      result = result.replace(/{service}/g, data.service.toLowerCase());
    }
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

  // Добавляем детали
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