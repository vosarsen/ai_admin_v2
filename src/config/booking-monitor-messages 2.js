/**
 * Конфигурация сообщений для booking monitor
 */

const messages = {
  cancellation: {
    template: `Ваша запись отменена

{date} в {time}
{services}

Если это ошибка, пожалуйста, свяжитесь с нами для восстановления записи.`
  },

  change: {
    template: `Ваша запись изменена

{changesList}

Актуальные данные:
{date} в {time}
{services}
Мастер: {staff}
Стоимость: {price} руб.

Если есть вопросы - пишите!`,

    changes: {
      time: 'Время изменено: {oldDateTime} → {newDateTime}',
      staff: 'Мастер изменен: {oldStaff} → {newStaff}',
      services: 'Услуги изменены',
      notSpecified: 'Не указан'
    }
  },

  defaults: {
    service: 'Услуга',
    staff: 'Специалист'
  }
};

module.exports = messages;