import '../shared/Card.css';

export const Guarantees = () => {
  return (
    <section className="section fade-in">
      <h2 className="section-title">Наши гарантии</h2>
      <div className="grid-3">
        <div className="card" style={{animationDelay: '0.1s'}}>
          <div className="card-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </div>
          <h3>Запуск за 24 часа</h3>
          <p>Начнете работать с ботом уже завтра</p>
        </div>

        <div className="card" style={{animationDelay: '0.2s'}}>
          <div className="card-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 4L12 14.01l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3>30 дней пробного периода</h3>
          <p>Тестируйте без риска целый месяц</p>
        </div>

        <div className="card" style={{animationDelay: '0.3s'}}>
          <div className="card-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 8v6M23 11h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3>Минимум 20 записей</h3>
          <p>Гарантируем результат или вернем деньги</p>
        </div>
      </div>
    </section>
  );
};

export default Guarantees;
