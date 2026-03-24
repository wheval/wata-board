import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { NetworkSwitcher } from './NetworkSwitcher';
import MobileNavigation from './MobileNavigation';

export const ResponsiveNavigation: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path ? 'text-sky-400' : 'text-slate-300 hover:text-slate-100';
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <nav className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-sm sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="text-xl font-semibold tracking-tight text-slate-100">
                Wata-Board
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex lg:items-center lg:gap-8">
              <div className="flex items-center gap-6 text-sm">
                <Link to="/" className={`transition ${isActive('/')}`}>Pay Bill</Link>
                <Link to="/about" className={`transition ${isActive('/about')}`}>About</Link>
                <Link to="/contact" className={`transition ${isActive('/contact')}`}>Contact</Link>
                <Link to="/rate" className={`transition ${isActive('/rate')}`}>Rate Us</Link>
              </div>
              <NetworkSwitcher showLabel={false} />
            </div>

            {/* Mobile menu button */}
            <div className="lg:hidden flex items-center gap-3">
              <NetworkSwitcher showLabel={false} />
              <button
                onClick={toggleMobileMenu}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                aria-label="Toggle menu"
                aria-expanded={isMobileMenuOpen}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isMobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Tablet Navigation (hidden on mobile, shown on tablet) */}
          <div className="hidden md:flex lg:hidden py-3 border-t border-slate-800">
            <div className="flex items-center gap-4 text-sm w-full justify-center">
              <Link to="/" className={`transition px-3 py-1 rounded-md ${isActive('/')}`}>Pay Bill</Link>
              <Link to="/about" className={`transition px-3 py-1 rounded-md ${isActive('/about')}`}>About</Link>
              <Link to="/contact" className={`transition px-3 py-1 rounded-md ${isActive('/contact')}`}>Contact</Link>
              <Link to="/rate" className={`transition px-3 py-1 rounded-md ${isActive('/rate')}`}>Rate Us</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation Menu */}
      <MobileNavigation isOpen={isMobileMenuOpen} onClose={closeMobileMenu} />
    </>
  );
};
