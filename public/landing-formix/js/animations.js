/**
 * Scroll Animation Controller
 * Uses Intersection Observer for performant scroll-triggered animations
 */

(function() {
  'use strict';

  /**
   * ScrollAnimations Class
   * Manages scroll-triggered animations using Intersection Observer API
   */
  class ScrollAnimations {
    constructor() {
      this.elements = document.querySelectorAll('[data-animate]');
      this.observer = null;
      this.init();
    }

    init() {
      // Check if Intersection Observer is supported
      if (!('IntersectionObserver' in window)) {
        console.warn('IntersectionObserver not supported. Animations will be disabled.');
        // Fallback: show all elements immediately
        this.elements.forEach(el => el.classList.add('animate-in'));
        return;
      }

      // Create observer with options
      this.observer = new IntersectionObserver(
        (entries) => this.handleIntersection(entries),
        {
          threshold: 0.2, // Trigger when 20% of element is visible
          rootMargin: '0px 0px -100px 0px' // Trigger 100px before element enters viewport
        }
      );

      // Observe all elements with [data-animate] attribute
      this.elements.forEach(el => this.observer.observe(el));
    }

    handleIntersection(entries) {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const delay = entry.target.dataset.animateDelay || 0;

          // Apply animation with optional delay
          setTimeout(() => {
            entry.target.classList.add('animate-in');
            // Unobserve after animation (one-time trigger)
            this.observer.unobserve(entry.target);
          }, delay);
        }
      });
    }

    /**
     * Manually trigger animation for a specific element
     * @param {Element} element - The element to animate
     */
    animateElement(element) {
      if (element && element.dataset.animate) {
        const delay = element.dataset.animateDelay || 0;
        setTimeout(() => {
          element.classList.add('animate-in');
        }, delay);
      }
    }

    /**
     * Manually trigger animations for all elements
     * Useful for forcing animations without scroll
     */
    animateAll() {
      this.elements.forEach(el => {
        const delay = el.dataset.animateDelay || 0;
        setTimeout(() => {
          el.classList.add('animate-in');
        }, delay);
      });
    }

    /**
     * Reset animations (remove animate-in class)
     * Useful for re-triggering animations
     */
    reset() {
      this.elements.forEach(el => el.classList.remove('animate-in'));
    }

    /**
     * Destroy observer and clean up
     */
    destroy() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
    }
  }

  // Initialize when DOM is ready
  function initAnimations() {
    // Check for prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      console.log('Reduced motion preference detected. Disabling scroll animations.');
      // Show all elements immediately
      document.querySelectorAll('[data-animate]').forEach(el => {
        el.classList.add('animate-in');
      });
      return;
    }

    // Create global instance
    window.scrollAnimations = new ScrollAnimations();
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnimations);
  } else {
    initAnimations();
  }

  // Re-initialize on soft page transitions (if using SPA framework in the future)
  document.addEventListener('page:load', function() {
    if (window.scrollAnimations) {
      window.scrollAnimations.destroy();
    }
    initAnimations();
  });

})();
