// Конфигурация API
const API_URL = 'http://localhost:3001/api';

// Улучшенная функция обработки платежа с реальной интеграцией
async function processPayment(data) {
    try {
        // Определяем endpoint в зависимости от метода оплаты
        let endpoint = '/payment/create';
        let requestData = {
            email: data.email,
            name: data.name,
            phone: data.phone,
            plan: data.plan,
            paymentMethod: data.paymentMethod
        };

        // Если выбран счет для организации
        if (data.paymentMethod === 'invoice') {
            endpoint = '/invoice/create';
            // Добавляем дополнительные поля для юр.лица
            const companyData = await showCompanyModal();
            if (!companyData) return { success: false };

            requestData = { ...requestData, ...companyData };
        }

        // Отправляем запрос к серверу
        const response = await fetch(API_URL + endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });

        const result = await response.json();

        if (result.success) {
            // Для онлайн оплаты перенаправляем на платежную страницу
            if (result.paymentUrl) {
                // Сохраняем ID платежа для отслеживания
                localStorage.setItem('pendingPaymentId', result.paymentId);

                // Перенаправляем на страницу оплаты YooKassa
                window.location.href = result.paymentUrl;
            }

            // Для счета показываем информацию о скачивании
            if (result.invoiceId) {
                showInvoiceInfo(result);
            }

            return result;
        } else {
            throw new Error(result.error || 'Ошибка при создании платежа');
        }

    } catch (error) {
        console.error('Payment processing error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Проверка статуса платежа
async function checkPaymentStatus(paymentId) {
    try {
        const response = await fetch(`${API_URL}/payment/status/${paymentId}`);
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Status check error:', error);
        return { success: false };
    }
}

// Модальное окно для данных организации
async function showCompanyModal() {
    return new Promise((resolve) => {
        const modalHtml = `
            <div id="companyModal" class="modal show">
                <div class="modal-content">
                    <span class="close-modal" onclick="closeCompanyModal()">&times;</span>
                    <h2>Данные организации</h2>
                    <form id="companyForm">
                        <div class="form-group">
                            <label>Название организации</label>
                            <input type="text" id="companyName" required placeholder="ООО Компания">
                        </div>
                        <div class="form-group">
                            <label>ИНН</label>
                            <input type="text" id="inn" required placeholder="1234567890" maxlength="12">
                        </div>
                        <div class="form-group">
                            <label>КПП (для юр. лиц)</label>
                            <input type="text" id="kpp" placeholder="123456789" maxlength="9">
                        </div>
                        <div class="form-group">
                            <label>Юридический адрес</label>
                            <input type="text" id="legalAddress" required placeholder="г. Москва, ул. Примерная, д. 1">
                        </div>
                        <button type="submit" class="btn-primary btn-block">Сформировать счет</button>
                    </form>
                </div>
            </div>
        `;

        // Добавляем модальное окно в DOM
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const form = document.getElementById('companyForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const companyData = {
                companyName: document.getElementById('companyName').value,
                inn: document.getElementById('inn').value,
                kpp: document.getElementById('kpp').value,
                legalAddress: document.getElementById('legalAddress').value
            };

            // Закрываем модальное окно
            document.getElementById('companyModal').remove();
            resolve(companyData);
        });
    });
}

// Закрытие модального окна компании
function closeCompanyModal() {
    const modal = document.getElementById('companyModal');
    if (modal) modal.remove();
}

// Показ информации о счете
function showInvoiceInfo(invoiceData) {
    const modalHtml = `
        <div id="invoiceModal" class="modal show">
            <div class="modal-content success-content">
                <div class="success-icon">📄</div>
                <h2>Счет сформирован</h2>
                <p>Счет №${invoiceData.invoiceId} отправлен на указанный email.</p>
                <p>Также вы можете скачать его прямо сейчас:</p>
                <a href="${invoiceData.downloadUrl}" class="btn-primary" download>
                    Скачать счет
                </a>
                <button class="btn-secondary" onclick="closeInvoiceModal()" style="margin-top: 1rem">
                    Закрыть
                </button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Закрытие модального окна счета
function closeInvoiceModal() {
    const modal = document.getElementById('invoiceModal');
    if (modal) modal.remove();
}

// Обработка возврата после оплаты
document.addEventListener('DOMContentLoaded', function() {
    // Проверяем, вернулся ли пользователь после оплаты
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');

    if (paymentStatus === 'success') {
        // Получаем ID платежа из localStorage
        const paymentId = localStorage.getItem('pendingPaymentId');

        if (paymentId) {
            // Проверяем статус платежа
            checkPaymentStatus(paymentId).then(result => {
                if (result.success && result.paid) {
                    // Показываем модальное окно успеха
                    const successModal = document.getElementById('successModal');
                    if (successModal) {
                        successModal.classList.add('show');
                    }
                }
                // Очищаем localStorage
                localStorage.removeItem('pendingPaymentId');
            });
        }
    }
});

// Интеграция с различными платежными системами
class PaymentProvider {
    constructor(provider) {
        this.provider = provider;
    }

    // YooKassa (ЮKassa) - основная для России
    async processYooKassa(data) {
        return await fetch(`${API_URL}/payment/yookassa`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    }

    // Stripe - для международных платежей
    async processStripe(data) {
        return await fetch(`${API_URL}/payment/stripe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    }

    // Tinkoff - альтернатива для России
    async processTinkoff(data) {
        return await fetch(`${API_URL}/payment/tinkoff`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    }
}

// Валидация данных карты
function validateCardNumber(number) {
    // Алгоритм Луна для проверки номера карты
    const digits = number.replace(/\D/g, '');
    let sum = 0;
    let isEven = false;

    for (let i = digits.length - 1; i >= 0; i--) {
        let digit = parseInt(digits[i], 10);

        if (isEven) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }

        sum += digit;
        isEven = !isEven;
    }

    return sum % 10 === 0;
}

// Определение типа карты
function getCardType(number) {
    const patterns = {
        visa: /^4/,
        mastercard: /^5[1-5]/,
        mir: /^220[0-4]/,
        maestro: /^(5018|5020|5038|6304|6759|676[1-3])/
    };

    for (const [type, pattern] of Object.entries(patterns)) {
        if (pattern.test(number)) {
            return type;
        }
    }

    return 'unknown';
}

// Экспорт функций для использования в main.js
window.PaymentIntegration = {
    processPayment,
    checkPaymentStatus,
    validateCardNumber,
    getCardType,
    PaymentProvider
};