import './Integration.css';

export const Integration = () => {
  return (
    <section className="section fade-in">
      <h2 className="section-title">Простая интеграция за 3 шага</h2>
      <div className="integration-steps">
        <div className="integration-card">
          <div className="integration-number">01</div>
          <h3>Подключение WhatsApp</h3>
          <p>Сканируйте QR-код для подключения бота к вашему WhatsApp Business</p>
          <div className="integration-visual">
            <div className="qr-placeholder">
              <div className="qr-line"></div>
              <div className="qr-line"></div>
              <div className="qr-line"></div>
              <div className="qr-line"></div>
            </div>
          </div>
        </div>

        <div className="integration-card">
          <div className="integration-number">02</div>
          <h3>Интеграция с YClients</h3>
          <p>Вводите API ключ от YClients для синхронизации расписания</p>
          <div className="integration-visual">
            <div className="api-placeholder">
              <span className="api-label">API_KEY:</span>
              <span className="api-dots">•••••••••••••</span>
            </div>
          </div>
        </div>

        <div className="integration-card">
          <div className="integration-number">03</div>
          <h3>Настройка и запуск</h3>
          <p>Настройте приветствие и правила работы - бот готов к работе!</p>
          <div className="integration-visual">
            <div className="chat-preview">
              <div className="chat-bubble-preview">Здравствуйте! Чем могу помочь?</div>
              <div className="chat-button-preview">Хочу записаться на стрижку</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Integration;
