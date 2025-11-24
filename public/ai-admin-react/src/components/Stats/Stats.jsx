import './Stats.css';

export const Stats = () => {
  return (
    <section className="section stats-section">
      <div className="stats-grid">
        <div className="stat-item fade-in">
          <div className="stat-number">1,500+</div>
          <div className="stat-label">Активных салонов</div>
        </div>
        <div className="stat-item fade-in">
          <div className="stat-number">95%</div>
          <div className="stat-label">Автоматизация</div>
        </div>
        <div className="stat-item fade-in">
          <div className="stat-number">24/7</div>
          <div className="stat-label">Поддержка клиентов</div>
        </div>
      </div>
    </section>
  );
};

export default Stats;
