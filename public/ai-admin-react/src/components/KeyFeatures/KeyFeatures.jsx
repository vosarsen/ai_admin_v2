import '../shared/Card.css';

export const KeyFeatures = () => {
  return (
    <section className="section fade-in">
      <h2 className="section-title">Ключевые возможности</h2>
      <div className="grid-3">
        <div className="card" style={{animationDelay: '0.1s'}}>
          <div className="card-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3>Умные диалоги</h3>
          <p>AI понимает контекст и отвечает как живой администратор</p>
        </div>

        <div className="card" style={{animationDelay: '0.2s'}}>
          <div className="card-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
              <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <h3>Онлайн-запись</h3>
          <p>Автоматическое бронирование с проверкой расписания мастеров</p>
        </div>

        <div className="card" style={{animationDelay: '0.3s'}}>
          <div className="card-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3>Напоминания</h3>
          <p>Автоматические уведомления клиентам о записях</p>
        </div>

        <div className="card" style={{animationDelay: '0.4s'}}>
          <div className="card-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 3h18v18H3zM3 9h18M9 21V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3>Управление расписанием</h3>
          <p>Синхронизация с YClients в реальном времени</p>
        </div>

        <div className="card" style={{animationDelay: '0.5s'}}>
          <div className="card-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM17 11l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3>CRM для клиентов</h3>
          <p>История общения и предпочтения каждого клиента</p>
        </div>

        <div className="card" style={{animationDelay: '0.6s'}}>
          <div className="card-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3>Аналитика</h3>
          <p>Статистика записей, конверсии и эффективности бота</p>
        </div>
      </div>
    </section>
  );
};

export default KeyFeatures;
