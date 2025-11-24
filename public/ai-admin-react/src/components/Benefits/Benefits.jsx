import '../shared/Card.css';
import './Benefits.css';

export const Benefits = () => {
  return (
    <section className="section fade-in" id="features">
      <h2 className="section-title">Преимущества для пилотных партнеров</h2>
      <div className="grid-2">
        <div className="card" style={{animationDelay: '0.1s'}}>
          <div className="card-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M9 18v2h6v-2H9m-2-2h10a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5h3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3>Не спящий администратор</h3>
          <ul>
            <li>AI бот обучен на 1000+ диалогах салонов</li>
            <li>24/7 мгновенные ответы</li>
            <li>50+ параллельных диалогов</li>
            <li>97% понимание запросов</li>
          </ul>
        </div>

        <div className="card" style={{animationDelay: '0.2s'}}>
          <div className="card-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0-3 3v1a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-6a3 3 0 0 0-3-3V9a3 3 0 0 0-3-3V5a3 3 0 0 0-3-3Zm0 2a1 1 0 0 1 1 1v1h-2V5a1 1 0 0 1 1-1Zm-3 4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1H9V8Zm-3 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-6Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3>Идеальная память</h3>
          <ul>
            <li>Импорт клиентской базы</li>
            <li>Запоминание истории клиента</li>
            <li>Персонализированные приветствия</li>
            <li>Отслеживание предпочтений мастеров</li>
          </ul>
        </div>

        <div className="card" style={{animationDelay: '0.3s'}}>
          <div className="card-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3>Умная персонализация</h3>
          <ul>
            <li>15-20% конверсия</li>
            <li>Персонализированные сообщения реактивации</li>
            <li>Индивидуальный подход к каждому клиенту</li>
          </ul>
        </div>

        <div className="card" style={{animationDelay: '0.4s'}}>
          <div className="card-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 10h.01M15 10h.01M9.5 14.5s1 1 2.5 1 2.5-1 2.5-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3>Поддержка пилотного партнера</h3>
          <ul>
            <li>Личный менеджер</li>
            <li>Ответ в течение 30 минут</li>
            <li>Еженедельные звонки для проверки</li>
          </ul>
        </div>
      </div>
    </section>
  );
};

export default Benefits;
