// src/config/business-types.js
/**
 * Конфигурация для разных типов beauty-бизнеса
 * Позволяет AI адаптироваться под специфику каждого типа
 */

module.exports = {
  // Барбершоп
  barbershop: {
    terminology: {
      role: 'администратор барбершопа',
      businessType: 'барбершоп',
      services: 'услуги',
      service: 'услуга',
      specialists: 'барберы',
      specialist: 'барбер',
      client: 'клиент',
      clients: 'клиенты',
      appointment: 'запись',
      schedule: 'расписание'
    },
    communication: {
      style: 'дружелюбным и неформальным',
      greeting: 'Привет! Как дела? Что подстричь будем?',
      confirmation: 'Отлично, бро! Записал тебя',
      cancellation: 'Жаль, что не получится. Приходи в другой раз!'
    },
    suggestions: {
      popular: ['стрижка', 'стрижка + борода', 'моделирование бороды'],
      additional: ['камуфляж седины', 'уход за волосами', 'королевское бритье'],
      seasonal: {
        summer: ['короткая стрижка', 'освежающий уход'],
        winter: ['уход за бородой', 'восстанавливающие процедуры']
      }
    },
    businessRules: {
      minBookingHours: 1,
      maxBookingDays: 30,
      allowWalkIns: true,
      requireDeposit: false
    }
  },

  // Ногтевая студия
  nails: {
    terminology: {
      role: 'администратор студии маникюра',
      businessType: 'ногтевая студия',
      services: 'услуги',
      service: 'услуга',
      specialists: 'мастера',
      specialist: 'мастер',
      client: 'клиентка',
      clients: 'клиентки',
      appointment: 'запись',
      schedule: 'расписание'
    },
    communication: {
      style: 'вежливым и заботливым',
      greeting: 'Добрый день! Рада вас слышать. Чем могу помочь?',
      confirmation: 'Прекрасно! Ваша запись подтверждена',
      cancellation: 'Понимаю, бывает. Будем рады видеть вас в другое время'
    },
    suggestions: {
      popular: ['маникюр с покрытием', 'педикюр', 'наращивание'],
      additional: ['дизайн ногтей', 'укрепление', 'парафинотерапия'],
      seasonal: {
        summer: ['яркий дизайн', 'морская тематика', 'неоновые цвета'],
        winter: ['новогодний дизайн', 'теплые оттенки', 'уход за кожей рук']
      }
    },
    businessRules: {
      minBookingHours: 2,
      maxBookingDays: 45,
      allowWalkIns: false,
      requireDeposit: true,
      depositPercent: 30
    }
  },

  // Массажный салон
  massage: {
    terminology: {
      role: 'администратор массажного салона',
      businessType: 'массажный салон',
      services: 'процедуры',
      service: 'процедура',
      specialists: 'массажисты',
      specialist: 'массажист',
      client: 'гость',
      clients: 'гости',
      appointment: 'сеанс',
      schedule: 'расписание сеансов'
    },
    communication: {
      style: 'спокойным и профессиональным',
      greeting: 'Здравствуйте. Добро пожаловать в наш салон. Как могу вам помочь?',
      confirmation: 'Ваш сеанс забронирован. Мы вас ждем',
      cancellation: 'Хорошо, мы отменили вашу запись. Надеемся увидеть вас позже'
    },
    suggestions: {
      popular: ['классический массаж', 'релакс массаж', 'антицеллюлитный'],
      additional: ['стоун-терапия', 'ароматерапия', 'обертывания'],
      seasonal: {
        summer: ['лимфодренаж', 'моделирующий массаж'],
        winter: ['горячие камни', 'медовый массаж', 'разогревающий']
      }
    },
    businessRules: {
      minBookingHours: 4,
      maxBookingDays: 14,
      allowWalkIns: false,
      requireDeposit: true,
      depositPercent: 50,
      requireConsultation: true
    }
  },

  // Студия эпиляции
  epilation: {
    terminology: {
      role: 'администратор студии эпиляции',
      businessType: 'студия лазерной эпиляции',
      services: 'процедуры',
      service: 'процедура',
      specialists: 'специалисты',
      specialist: 'специалист',
      client: 'клиент',
      clients: 'клиенты',
      appointment: 'сеанс',
      schedule: 'график процедур'
    },
    communication: {
      style: 'деликатным и информативным',
      greeting: 'Здравствуйте! Спасибо за обращение. Готова ответить на ваши вопросы',
      confirmation: 'Отлично! Ваша процедура запланирована',
      cancellation: 'Понимаю. Запись отменена. Важно соблюдать график процедур для лучшего эффекта'
    },
    suggestions: {
      popular: ['лазерная эпиляция ног', 'бикини', 'подмышки'],
      additional: ['лицо', 'руки полностью', 'мужская эпиляция'],
      packages: ['курс из 6 процедур', 'годовой абонемент', 'комплекс всё тело'],
      seasonal: {
        summer: ['экспресс-подготовка к отпуску', 'зоны в подарок'],
        winter: ['начни курс сейчас', 'скидки на курсы', 'подготовка к лету']
      }
    },
    businessRules: {
      minBookingHours: 24,
      maxBookingDays: 60,
      allowWalkIns: false,
      requireDeposit: true,
      depositPercent: 100,
      requireConsultation: true,
      coursesAvailable: true,
      minTimeBetweenSessions: 28 // дней
    }
  },

  // Салон красоты (универсальный)
  beauty: {
    terminology: {
      role: 'администратор салона красоты',
      businessType: 'салон красоты',
      services: 'услуги',
      service: 'услуга',
      specialists: 'мастера',
      specialist: 'мастер',
      client: 'клиент',
      clients: 'клиенты',
      appointment: 'запись',
      schedule: 'расписание'
    },
    communication: {
      style: 'приветливым и профессиональным',
      greeting: 'Добрый день! Рады вас слышать. Чем могу помочь?',
      confirmation: 'Замечательно! Ваша запись подтверждена',
      cancellation: 'Хорошо, запись отменена. Будем рады видеть вас в другое время'
    },
    suggestions: {
      popular: ['стрижка', 'окрашивание', 'маникюр', 'макияж'],
      additional: ['уход за волосами', 'spa-процедуры', 'косметология'],
      packages: ['свадебный образ', 'день красоты', 'подготовка к празднику'],
      seasonal: {
        summer: ['защита волос', 'легкий макияж', 'педикюр'],
        winter: ['восстановление волос', 'уход за кожей', 'spa']
      }
    },
    businessRules: {
      minBookingHours: 2,
      maxBookingDays: 30,
      allowWalkIns: true,
      requireDeposit: false,
      multiServiceBooking: true
    }
  },

  // Брови и ресницы
  brows: {
    terminology: {
      role: 'администратор студии бровей',
      businessType: 'brow bar',
      services: 'услуги',
      service: 'услуга',
      specialists: 'бровисты',
      specialist: 'бровист',
      client: 'гостья',
      clients: 'гостьи',
      appointment: 'запись',
      schedule: 'расписание'
    },
    communication: {
      style: 'дружелюбным и экспертным',
      greeting: 'Привет! Хотите идеальные брови? Я помогу!',
      confirmation: 'Супер! Жду вас, будет красиво',
      cancellation: 'Жаль! Но ничего, запишемся в другой раз'
    },
    suggestions: {
      popular: ['коррекция бровей', 'окрашивание', 'ламинирование'],
      additional: ['наращивание ресниц', 'ламинирование ресниц', 'velvet'],
      packages: ['брови + ресницы', 'полный образ', 'долговременная укладка'],
      seasonal: {
        summer: ['водостойкое окрашивание', 'натуральный эффект'],
        winter: ['питание и уход', 'яркое окрашивание', 'объемные ресницы']
      }
    },
    businessRules: {
      minBookingHours: 1,
      maxBookingDays: 21,
      allowWalkIns: true,
      requireDeposit: false,
      reminderBeforeCorrection: 21 // дней - напомнить о коррекции
    }
  }
};

/**
 * Автоматическое определение типа бизнеса по ключевым словам
 */
function detectBusinessType(companyName, services = []) {
  const name = companyName.toLowerCase();
  const serviceNames = services.map(s => s.title?.toLowerCase() || '').join(' ');
  const combined = `${name} ${serviceNames}`;
  
  // Проверяем по ключевым словам
  const keywords = {
    barbershop: ['барбер', 'barber', 'мужская парикмахерская', 'men'],
    nails: ['ногт', 'маникюр', 'педикюр', 'nail', 'ноготки'],
    massage: ['массаж', 'спа', 'spa', 'релакс'],
    epilation: ['эпиляц', 'лазер', 'депиляц', 'шугаринг', 'воск'],
    brows: ['бров', 'ресниц', 'brow', 'lash']
  };
  
  for (const [type, words] of Object.entries(keywords)) {
    if (words.some(word => combined.includes(word))) {
      return type;
    }
  }
  
  return 'beauty'; // По умолчанию
}

module.exports.detectBusinessType = detectBusinessType;