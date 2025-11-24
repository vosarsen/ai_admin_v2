const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { YooCheckout } = require('@a2seven/yoo-checkout');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('../'));

// Инициализация YooKassa (ЮKassa)
const checkout = new YooCheckout({
    shopId: process.env.YOOKASSA_SHOP_ID,
    secretKey: process.env.YOOKASSA_SECRET_KEY
});

// Конфигурация тарифов
const PLANS = {
    start: {
        name: 'Тариф Старт',
        price: 1990,
        description: 'До 1000 сообщений в месяц'
    },
    business: {
        name: 'Тариф Бизнес',
        price: 4990,
        description: 'До 5000 сообщений в месяц'
    },
    premium: {
        name: 'Тариф Премиум',
        price: 9990,
        description: 'Безлимитные сообщения'
    }
};

// Создание платежа через YooKassa
app.post('/api/payment/create', async (req, res) => {
    try {
        const { email, name, phone, plan, paymentMethod } = req.body;

        // Валидация
        if (!email || !name || !phone || !plan) {
            return res.status(400).json({
                success: false,
                error: 'Заполните все обязательные поля'
            });
        }

        const planDetails = PLANS[plan];
        if (!planDetails) {
            return res.status(400).json({
                success: false,
                error: 'Неверный тариф'
            });
        }

        // Создаем платеж в YooKassa
        const payment = await checkout.createPayment({
            amount: {
                value: planDetails.price.toFixed(2),
                currency: 'RUB'
            },
            confirmation: {
                type: 'redirect',
                return_url: `${process.env.SITE_URL}/payment-success.html`
            },
            capture: true,
            description: `${planDetails.name} - ${email}`,
            metadata: {
                email,
                name,
                phone,
                plan
            },
            receipt: {
                customer: {
                    email,
                    phone: phone.replace(/\D/g, '')
                },
                items: [{
                    description: planDetails.name,
                    quantity: 1,
                    amount: {
                        value: planDetails.price.toFixed(2),
                        currency: 'RUB'
                    },
                    vat_code: 1,
                    payment_mode: 'full_payment',
                    payment_subject: 'service'
                }]
            }
        });

        // Сохраняем информацию о платеже в базе данных
        // В продакшене используйте настоящую базу данных
        console.log('Payment created:', payment.id);

        res.json({
            success: true,
            paymentUrl: payment.confirmation.confirmation_url,
            paymentId: payment.id
        });

    } catch (error) {
        console.error('Payment error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при создании платежа'
        });
    }
});

// Webhook для обработки уведомлений от YooKassa
app.post('/api/payment/webhook', async (req, res) => {
    try {
        const { object } = req.body;

        if (object.status === 'succeeded') {
            // Платеж успешно проведен
            const metadata = object.metadata;

            // Здесь активируем подписку для пользователя
            console.log('Payment succeeded:', object.id);
            console.log('User data:', metadata);

            // Отправляем email с подтверждением
            // await sendConfirmationEmail(metadata.email, metadata.plan);

            // Создаем аккаунт пользователя
            // await createUserAccount(metadata);
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).send('Error');
    }
});

// Проверка статуса платежа
app.get('/api/payment/status/:paymentId', async (req, res) => {
    try {
        const { paymentId } = req.params;

        const payment = await checkout.getPayment(paymentId);

        res.json({
            success: true,
            status: payment.status,
            paid: payment.paid
        });

    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при проверке статуса'
        });
    }
});

// Создание платежа для счета организации
app.post('/api/invoice/create', async (req, res) => {
    try {
        const { email, name, phone, plan, companyName, inn } = req.body;

        const planDetails = PLANS[plan];
        if (!planDetails) {
            return res.status(400).json({
                success: false,
                error: 'Неверный тариф'
            });
        }

        // Здесь генерируем счет для юридического лица
        // В реальном приложении используйте специальный сервис
        const invoiceId = 'INV-' + Date.now();

        res.json({
            success: true,
            invoiceId,
            downloadUrl: `/api/invoice/download/${invoiceId}`,
            message: 'Счет будет отправлен на указанный email'
        });

    } catch (error) {
        console.error('Invoice error:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка при создании счета'
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});