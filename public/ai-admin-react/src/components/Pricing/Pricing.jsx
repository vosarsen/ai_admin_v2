import './Pricing.css';

export const Pricing = () => {
  return (
    <section className="section fade-in" id="pricing">
      <h2 className="section-title">Специальные условия для пилотных партнеров</h2>
      <div className="grid-3">
        <div className="pricing-card">
          <p className="price-label">Обычная цена</p>
          <div className="price">39,990₽</div>
          <p className="price-period">в месяц</p>
        </div>

        <div className="pricing-card featured">
          <div className="badge">ПИЛОТНАЯ ЦЕНА</div>
          <p className="price-label">Специальное предложение</p>
          <div className="price">11,990₽</div>
          <p className="price-period">в месяц</p>
          <a href="#contact" className="btn">СТАТЬ ПАРТНЕРОМ</a>
        </div>

        <div className="pricing-card">
          <p className="price-label">После пилота</p>
          <div className="price">19,990₽</div>
          <p className="price-period">в месяц</p>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
