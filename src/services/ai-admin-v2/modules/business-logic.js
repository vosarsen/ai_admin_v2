const config = require('../../../config');
const businessTypes = require('../../../config/business-types');

class BusinessLogic {
  /**
   * Определение типа бизнеса по данным компании
   */
  detectBusinessType(company) {
    const title = company.title.toLowerCase();
    const services = company.raw_data?.services || [];
    
    if (title.includes('барбер') || title.includes('barber')) {
      return 'barbershop';
    } else if (title.includes('ногт') || title.includes('маникюр') || title.includes('nail')) {
      return 'nails';
    } else if (title.includes('массаж') || title.includes('спа') || title.includes('spa')) {
      return 'massage';
    } else if (title.includes('эпиляц') || title.includes('лазер')) {
      return 'epilation';
    } else if (title.includes('брови') || title.includes('ресниц')) {
      return 'brows';
    }
    
    return 'beauty'; // По умолчанию салон красоты
  }

  /**
   * Получение терминологии для типа бизнеса
   */
  getBusinessTerminology(businessType) {
    const terminology = {
      barbershop: {
        role: 'администратор барбершопа',
        businessType: 'барбершоп',
        services: 'услуги',
        specialists: 'барберы',
        communicationStyle: 'простым и дружелюбным, без лишних формальностей',
        suggestions: 'стрижку или уход за бородой'
      },
      nails: {
        role: 'администратор студии маникюра',
        businessType: 'ногтевая студия',
        services: 'услуги',
        specialists: 'мастера',
        communicationStyle: 'вежливым и заботливым',
        suggestions: 'актуальные дизайны и уходовые процедуры'
      },
      massage: {
        role: 'администратор массажного салона',
        businessType: 'массажный салон',
        services: 'процедуры',
        specialists: 'массажисты',
        communicationStyle: 'спокойным и профессиональным',
        suggestions: 'комплексные программы и курсы массажа'
      },
      epilation: {
        role: 'администратор студии эпиляции',
        businessType: 'студия лазерной эпиляции',
        services: 'процедуры',
        specialists: 'специалисты',
        communicationStyle: 'деликатным и информативным',
        suggestions: 'курсы процедур и сезонные предложения'
      },
      beauty: {
        role: 'администратор салона красоты',
        businessType: 'салон красоты',
        services: 'услуги',
        specialists: 'мастера',
        communicationStyle: 'приветливым и профессиональным',
        suggestions: 'комплексные услуги и акции'
      }
    };
    
    return terminology[businessType] || terminology.beauty;
  }

  /**
   * Сортировка услуг с учетом предпочтений клиента
   */
  sortServicesForClient(services, client) {
    if (!services || !Array.isArray(services)) {
      return [];
    }
    
    if (!client || !client.last_service_ids?.length) {
      return services;
    }
    
    // Услуги, которые клиент заказывал ранее, идут первыми
    const clientServices = [];
    const otherServices = [];
    
    services.forEach(service => {
      if (client?.last_service_ids?.includes(service.yclients_id)) {
        clientServices.push(service);
      } else {
        otherServices.push(service);
      }
    });
    
    return [...clientServices, ...otherServices];
  }
}

module.exports = new BusinessLogic();