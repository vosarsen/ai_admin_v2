import './Problems.css';

export const Problems = () => {
  return (
    <section className="section fade-in">
      <h2 className="section-title">Знакомые проблемы?</h2>
      <div className="grid-4">
        <div className="problem-card">
          <div className="problem-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="problem-title">Сообщения после 19:00</div>
          <div className="problem-text">Клиенты уходят к конкурентам</div>
        </div>

        <div className="problem-card">
          <div className="problem-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M11.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" stroke="currentColor" strokeWidth="2"/>
              <line x1="11.5" y1="14" x2="11.5" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="problem-title">Администратор заболел</div>
          <div className="problem-text">Записи теряются</div>
        </div>

        <div className="problem-card">
          <div className="problem-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="problem-title">Текучка кадров</div>
          <div className="problem-text">Новый админ каждые 3 месяца</div>
        </div>

        <div className="problem-card">
          <div className="problem-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="problem-title">Зарплата</div>
          <div className="problem-text">40-60к с рисками обучения</div>
        </div>
      </div>
    </section>
  );
};

export default Problems;
