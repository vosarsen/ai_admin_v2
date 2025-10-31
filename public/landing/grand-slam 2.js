// Grand Slam Offer Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Smooth scrolling for navigation links
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href.startsWith('#')) {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    const offsetTop = target.offsetTop - 100;
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });

    // Add scroll effect to navbar
    const navbar = document.querySelector('.navbar');
    let lastScroll = 0;
    
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > 50) {
            navbar.style.background = 'rgba(255, 255, 255, 0.95)';
            navbar.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1)';
        } else {
            navbar.style.background = 'rgba(255, 255, 255, 0.8)';
            navbar.style.boxShadow = 'none';
        }
        
        lastScroll = currentScroll;
    });

    // Animate elements on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                
                // Add stagger effect for grid items
                if (entry.target.classList.contains('problem-card') ||
                    entry.target.classList.contains('offer-card') ||
                    entry.target.classList.contains('bonus-card') ||
                    entry.target.classList.contains('faq-item')) {
                    const cards = entry.target.parentElement.children;
                    const index = Array.from(cards).indexOf(entry.target);
                    entry.target.style.transitionDelay = `${index * 0.1}s`;
                }
            }
        });
    }, observerOptions);

    // Observe elements
    const animatedElements = document.querySelectorAll(
        '.problem-card, .offer-card, .bonus-card, .guarantee-card, .faq-item, .roi-container, .pricing-card'
    );
    
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });

    // Countdown timer for urgency
    function updateCountdown() {
        const deadline = new Date('2025-02-01T23:59:59');
        const now = new Date();
        const diff = deadline - now;
        
        if (diff > 0) {
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            
            const deadlineElement = document.querySelector('.deadline-date');
            if (deadlineElement && days <= 30) {
                deadlineElement.innerHTML = `Осталось ${days} дней ${hours} часов`;
                deadlineElement.style.animation = 'pulse 2s infinite';
            }
        }
    }
    
    updateCountdown();
    setInterval(updateCountdown, 60000); // Update every minute

    // CTA Button actions
    const ctaButtons = document.querySelectorAll('.btn-primary, .grand-slam-cta');
    ctaButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            if (!this.href) {
                e.preventDefault();
                // Here you would typically open a modal or redirect to a form
                showApplicationForm();
            }
        });
    });

    // Demo button
    const demoButtons = document.querySelectorAll('.btn-secondary');
    demoButtons.forEach(button => {
        if (button.textContent.includes('демо')) {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                // Here you would typically open a video modal
                alert('Демо-видео будет доступно в ближайшее время!');
            });
        }
    });

    // Application form (placeholder)
    function showApplicationForm() {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'application-modal';
        modal.innerHTML = `
            <div class="modal-content glass-card">
                <button class="modal-close">&times;</button>
                <h2>Заявка на участие в пилоте</h2>
                <form class="application-form">
                    <div class="form-group">
                        <label>Имя *</label>
                        <input type="text" name="name" required>
                    </div>
                    <div class="form-group">
                        <label>Телефон *</label>
                        <input type="tel" name="phone" required placeholder="+7 (___) ___-__-__">
                    </div>
                    <div class="form-group">
                        <label>Название салона</label>
                        <input type="text" name="salon">
                    </div>
                    <div class="form-group">
                        <label>Используете YClients?</label>
                        <select name="yclients">
                            <option value="yes">Да</option>
                            <option value="no">Нет</option>
                            <option value="planning">Планируем подключить</option>
                        </select>
                    </div>
                    <button type="submit" class="btn-primary">Отправить заявку</button>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .application-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                animation: fadeIn 0.3s ease;
            }
            
            .modal-content {
                max-width: 500px;
                width: 90%;
                padding: 2.5rem;
                position: relative;
                animation: slideUp 0.3s ease;
            }
            
            .modal-close {
                position: absolute;
                top: 1rem;
                right: 1rem;
                background: none;
                border: none;
                font-size: 2rem;
                cursor: pointer;
                color: var(--text-secondary);
                transition: color 0.3s ease;
            }
            
            .modal-close:hover {
                color: var(--text-primary);
            }
            
            .application-form {
                margin-top: 2rem;
            }
            
            .form-group {
                margin-bottom: 1.5rem;
            }
            
            .form-group label {
                display: block;
                margin-bottom: 0.5rem;
                font-weight: 600;
                color: var(--text-primary);
            }
            
            .form-group input,
            .form-group select {
                width: 100%;
                padding: 0.75rem;
                border: 1px solid var(--border);
                border-radius: 8px;
                font-size: 1rem;
                transition: border-color 0.3s ease;
            }
            
            .form-group input:focus,
            .form-group select:focus {
                outline: none;
                border-color: var(--primary);
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes slideUp {
                from { transform: translateY(30px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        // Close modal
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.remove();
            style.remove();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                style.remove();
            }
        });
        
        // Handle form submission
        modal.querySelector('.application-form').addEventListener('submit', (e) => {
            e.preventDefault();
            // Here you would typically send the form data to your server
            alert('Спасибо за заявку! Мы свяжемся с вами в течение 24 часов.');
            modal.remove();
            style.remove();
        });
    }

    // Parallax effect for orbs
    const orbs = document.querySelectorAll('.floating-orb');
    let ticking = false;
    
    function updateParallax() {
        const scrolled = window.pageYOffset;
        
        orbs.forEach((orb, index) => {
            const speed = 0.5 + (index * 0.2);
            const yPos = -(scrolled * speed);
            orb.style.transform = `translateY(${yPos}px)`;
        });
        
        ticking = false;
    }
    
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(updateParallax);
            ticking = true;
        }
    });

    // Add pulse animation styles
    const pulseStyle = document.createElement('style');
    pulseStyle.textContent = `
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
    `;
    document.head.appendChild(pulseStyle);
});