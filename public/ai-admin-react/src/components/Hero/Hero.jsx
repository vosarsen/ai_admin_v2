import './Hero.css';

export const Hero = () => {
  return (
    <section className="hero" id="home">
      <div className="hero-content">
        <h1>WhatsApp бот который понимает ваших клиентов</h1>
        <p>AI Admin автоматически отвечает на сообщения, записывает клиентов и управляет расписанием вашего салона красоты 24/7</p>
        <a href="#contact" className="btn">ПОПРОБОВАТЬ БЕСПЛАТНО</a>
      </div>
      <div className="hero-image">
        <img src="/hero-phone.png" alt="WhatsApp диалог с AI Admin" />
      </div>
    </section>
  );
};

export default Hero;
