/**
 * Main JavaScript Entry Point
 * Initializes all modules and handles global page functionality
 */

(function() {
  'use strict';

  console.log('Admin AI Landing - Formix Redesign');
  console.log('Version: 1.0.0');

  /**
   * Initialize all page modules
   */
  function init() {
    // All other modules (navigation.js, animations.js, cursor.js) load independently
    // This file can be used for shared utilities or global initializations

    // Log successful initialization
    console.log('Page initialized successfully');

    // Add any global event listeners here
    setupGlobalListeners();
  }

  /**
   * Setup global event listeners
   */
  function setupGlobalListeners() {
    // Prevent default behavior for anchor links to non-existent pages
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href === '#' || href === '#!') {
          e.preventDefault();
        }
      });
    });

    // Optional: Track page visibility for analytics
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        console.log('Page hidden');
      } else {
        console.log('Page visible');
      }
    });
  }

  /**
   * Utility: Debounce function
   * Limits rate of function execution
   */
  window.debounce = function(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  /**
   * Utility: Throttle function
   * Ensures function is called at most once per specified time period
   */
  window.throttle = function(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
