/**
 * Custom Cursor (Optional Enhancement)
 * Smooth custom cursor that follows mouse movement
 * Disabled on touch devices for better UX
 */

(function() {
  'use strict';

  // Check if device supports touch (disable custom cursor on mobile)
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  if (isTouchDevice) {
    console.log('Touch device detected. Custom cursor disabled.');
    const cursor = document.querySelector('.custom-cursor');
    if (cursor) {
      cursor.style.display = 'none';
    }
    return;
  }

  // Custom cursor implementation
  // TODO: Implement custom cursor animation with requestAnimationFrame
  // For now, cursor is hidden/disabled

  const cursor = document.querySelector('.custom-cursor');
  if (cursor) {
    cursor.style.display = 'none'; // Hide for now
  }

  // Future implementation:
  // let mouseX = 0, mouseY = 0;
  // let cursorX = 0, cursorY = 0;
  //
  // document.addEventListener('mousemove', (e) => {
  //   mouseX = e.clientX;
  //   mouseY = e.clientY;
  // });
  //
  // function animateCursor() {
  //   const dx = mouseX - cursorX;
  //   const dy = mouseY - cursorY;
  //
  //   cursorX += dx * 0.15; // Easing factor
  //   cursorY += dy * 0.15;
  //
  //   cursor.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
  //   requestAnimationFrame(animateCursor);
  // }
  //
  // animateCursor();

})();
