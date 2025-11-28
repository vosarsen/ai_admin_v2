/**
 * Navigation JavaScript
 * Mobile menu toggle and scroll-based header effects
 */

(function() {
  'use strict';

  // DOM Elements
  const header = document.getElementById('header');
  const menuToggle = document.getElementById('menuToggle');
  const nav = document.getElementById('nav');
  const navLinks = nav ? nav.querySelectorAll('.nav__link') : [];

  // ===== MOBILE MENU TOGGLE =====

  if (menuToggle && nav) {
    menuToggle.addEventListener('click', function() {
      const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';

      // Toggle aria-expanded attribute
      menuToggle.setAttribute('aria-expanded', !isExpanded);

      // Toggle is-open class on nav
      nav.classList.toggle('is-open');
    });

    // Close menu when clicking nav links
    navLinks.forEach(link => {
      link.addEventListener('click', function() {
        menuToggle.setAttribute('aria-expanded', 'false');
        nav.classList.remove('is-open');
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', function(event) {
      const isClickInsideNav = nav.contains(event.target);
      const isClickOnToggle = menuToggle.contains(event.target);
      const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';

      if (!isClickInsideNav && !isClickOnToggle && isExpanded) {
        menuToggle.setAttribute('aria-expanded', 'false');
        nav.classList.remove('is-open');
      }
    });

    // Close menu on ESC key
    document.addEventListener('keydown', function(event) {
      const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';

      if (event.key === 'Escape' && isExpanded) {
        menuToggle.setAttribute('aria-expanded', 'false');
        nav.classList.remove('is-open');
        menuToggle.focus(); // Return focus to toggle button
      }
    });
  }

  // ===== SCROLL-BASED HEADER SHADOW =====

  let lastScrollY = window.scrollY;
  let ticking = false;

  function updateHeader() {
    const scrollY = window.scrollY;

    // Add shadow when scrolled down more than 10px
    if (scrollY > 10) {
      header.classList.add('header--scrolled');
    } else {
      header.classList.remove('header--scrolled');
    }

    lastScrollY = scrollY;
    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(updateHeader);
      ticking = true;
    }
  }

  // Listen for scroll events (passive for better performance)
  window.addEventListener('scroll', onScroll, { passive: true });

  // Initial check
  updateHeader();

  // ===== ACTIVE LINK HIGHLIGHTING =====

  /**
   * Updates the active navigation link based on current scroll position
   */
  function updateActiveLink() {
    const sections = document.querySelectorAll('section[id]');
    const scrollPosition = window.scrollY + 100; // Offset for header height

    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      const sectionId = section.getAttribute('id');
      const correspondingLink = nav ? nav.querySelector(`a[href="#${sectionId}"]`) : null;

      if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
        // Remove is-current from all links
        navLinks.forEach(link => link.classList.remove('is-current'));

        // Add is-current to current section link
        if (correspondingLink) {
          correspondingLink.classList.add('is-current');
        }
      }
    });
  }

  // Throttled scroll handler for active link
  let activeLinkticking = false;

  function onScrollActiveLink() {
    if (!activeLinkticking) {
      window.requestAnimationFrame(() => {
        updateActiveLink();
        activeLinkticking = false;
      });
      activeLinkticking = true;
    }
  }

  window.addEventListener('scroll', onScrollActiveLink, { passive: true });

  // Initial active link check
  updateActiveLink();

  // ===== SMOOTH SCROLL TO ANCHOR =====

  /**
   * Smooth scroll to anchor links with offset for fixed header
   */
  navLinks.forEach(link => {
    link.addEventListener('click', function(event) {
      const href = this.getAttribute('href');

      // Only handle internal anchor links
      if (href && href.startsWith('#')) {
        event.preventDefault();

        const targetId = href.substring(1);
        const targetSection = document.getElementById(targetId);

        if (targetSection) {
          const headerHeight = header.offsetHeight;
          const targetPosition = targetSection.offsetTop - headerHeight - 20; // 20px extra offset

          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
        }
      }
    });
  });

})();
