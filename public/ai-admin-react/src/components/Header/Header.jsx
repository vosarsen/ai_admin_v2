import { useState, useEffect } from 'react';
import GlassSurface from '../GlassSurface';
import './Header.css';

export const Header = () => {
  const [isCompact, setIsCompact] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsCompact(window.scrollY > 100);
    };

    const handleMouseMove = (e) => {
      const nav = document.querySelector('nav');
      if (nav) {
        const rect = nav.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        nav.style.setProperty('--mouse-x', `${x}%`);
        nav.style.setProperty('--mouse-y', `${y}%`);
      }
    };

    window.addEventListener('scroll', handleScroll);
    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <header className={isCompact ? 'compact' : ''}>
      <GlassSurface
        width="100%"
        height="auto"
        borderRadius={50}
        brightness={50}
        opacity={0.93}
        blur={11}
        backgroundOpacity={0.05}
        saturation={1.2}
        className="nav-glass"
      >
        <nav>
          <a href="#home" className="logo" onClick={closeMobileMenu}>
            AI ADMIN<sup>beta</sup>
          </a>

          <button
            className={`mobile-menu-toggle ${isMobileMenuOpen ? 'open' : ''}`}
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          <ul className={`nav-links ${isMobileMenuOpen ? 'open' : ''}`}>
            <li><a href="#features" onClick={closeMobileMenu}>ВОЗМОЖНОСТИ</a></li>
            <li><a href="#pricing" onClick={closeMobileMenu}>ЦЕНЫ</a></li>
            <li><a href="#contact" onClick={closeMobileMenu}>КОНТАКТЫ</a></li>
            <li><a href="#contact" className="nav-cta" onClick={closeMobileMenu}>ПОПРОБОВАТЬ БЕСПЛАТНО</a></li>
          </ul>
        </nav>
      </GlassSurface>
    </header>
  );
};

export default Header;
