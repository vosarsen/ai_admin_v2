// План и цены
let selectedPlan = null;
let selectedPrice = null;

// Функция выбора тарифа
function selectPlan(planName, price) {
    selectedPlan = planName;
    selectedPrice = price;

    // Обновляем информацию в модальном окне
    const planNames = {
        'start': 'Тариф Старт',
        'business': 'Тариф Бизнес',
        'premium': 'Тариф Премиум'
    };

    document.getElementById('selectedPlanName').textContent = planNames[planName];
    document.getElementById('selectedPrice').textContent = price.toLocaleString('ru-RU');
    document.getElementById('payButtonPrice').textContent = price.toLocaleString('ru-RU');

    // Открываем модальное окно
    openPaymentModal();
}

// Открытие модального окна оплаты
function openPaymentModal() {
    const modal = document.getElementById('paymentModal');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

// Закрытие модального окна оплаты
function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    modal.classList.remove('show');
    document.body.style.overflow = '';
}

// Закрытие модального окна успеха
function closeSuccessModal() {
    const modal = document.getElementById('successModal');
    modal.classList.remove('show');
    document.body.style.overflow = '';
}

// Прокрутка к секции
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

// Обработка формы оплаты
document.addEventListener('DOMContentLoaded', function() {
    const paymentForm = document.getElementById('paymentForm');

    // Переключение методов оплаты
    const paymentMethodRadios = document.querySelectorAll('input[name="paymentMethod"]');
    const cardPaymentSection = document.getElementById('cardPaymentSection');

    paymentMethodRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            // Убираем selected класс у всех опций
            document.querySelectorAll('.payment-option').forEach(option => {
                option.classList.remove('selected');
            });

            // Добавляем selected класс к выбранной опции
            this.parentElement.classList.add('selected');

            // Показываем/скрываем поля карты
            if (this.value === 'card') {
                cardPaymentSection.style.display = 'block';
            } else {
                cardPaymentSection.style.display = 'none';
            }
        });
    });

    // Форматирование номера карты
    const cardNumberInput = document.getElementById('cardNumber');
    if (cardNumberInput) {
        cardNumberInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\s/g, '');
            let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
            e.target.value = formattedValue;
        });
    }

    // Форматирование срока действия карты
    const cardExpiryInput = document.getElementById('cardExpiry');
    if (cardExpiryInput) {
        cardExpiryInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length >= 2) {
                value = value.slice(0, 2) + '/' + value.slice(2, 4);
            }
            e.target.value = value;
        });
    }

    // Форматирование CVV
    const cardCVVInput = document.getElementById('cardCVV');
    if (cardCVVInput) {
        cardCVVInput.addEventListener('input', function(e) {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 3);
        });
    }

    // Обработка отправки формы
    if (paymentForm) {
        paymentForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            // Получаем данные формы
            const formData = {
                email: document.getElementById('email').value,
                name: document.getElementById('name').value,
                phone: document.getElementById('phone').value,
                plan: selectedPlan,
                price: selectedPrice,
                paymentMethod: document.querySelector('input[name="paymentMethod"]:checked').value
            };

            // Если выбрана оплата картой, добавляем данные карты
            if (formData.paymentMethod === 'card') {
                formData.cardNumber = document.getElementById('cardNumber').value;
                formData.cardExpiry = document.getElementById('cardExpiry').value;
                formData.cardCVV = document.getElementById('cardCVV').value;
            }

            // Показываем индикатор загрузки на кнопке
            const submitButton = paymentForm.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;
            submitButton.textContent = 'Обработка...';
            submitButton.disabled = true;

            try {
                // Здесь будет реальный запрос к API платежной системы
                const response = await processPayment(formData);

                if (response.success) {
                    // Закрываем модальное окно оплаты
                    closePaymentModal();

                    // Показываем модальное окно успеха
                    const successModal = document.getElementById('successModal');
                    successModal.classList.add('show');

                    // Очищаем форму
                    paymentForm.reset();
                } else {
                    alert('Ошибка при обработке платежа. Пожалуйста, попробуйте еще раз.');
                }
            } catch (error) {
                console.error('Payment error:', error);
                alert('Произошла ошибка. Пожалуйста, проверьте данные и попробуйте снова.');
            } finally {
                // Возвращаем кнопку в исходное состояние
                submitButton.textContent = originalText;
                submitButton.disabled = false;
            }
        });
    }

    // Закрытие модального окна при клике вне его
    window.addEventListener('click', function(e) {
        const paymentModal = document.getElementById('paymentModal');
        const successModal = document.getElementById('successModal');

        if (e.target === paymentModal) {
            closePaymentModal();
        }
        if (e.target === successModal) {
            closeSuccessModal();
        }
    });

    // Мобильное меню
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');

    if (hamburger) {
        hamburger.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            this.classList.toggle('active');
        });
    }
});

// Функция обработки платежа теперь использует реальную интеграцию
async function processPayment(data) {
    // Используем функцию из payment-integration.js
    if (window.PaymentIntegration && window.PaymentIntegration.processPayment) {
        return await window.PaymentIntegration.processPayment(data);
    } else {
        // Fallback для демо режима
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('Demo payment processing:', data);
                resolve({ success: true, transactionId: 'DEMO-' + Date.now() });
            }, 2000);
        });
    }
}

// Анимация при скролле
window.addEventListener('scroll', function() {
    const header = document.querySelector('.header');
    if (window.scrollY > 50) {
        header.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
    } else {
        header.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
    }
});