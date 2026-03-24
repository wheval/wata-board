import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { NetworkSwitcher } from './NetworkSwitcher';

interface MobileNavigationProps {
  isOpen: boolean;
  onClose: () => void;
}

const MobileNavigation: React.FC<MobileNavigationProps> = ({ isOpen, onClose }) => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path ? 'text-sky-400' : 'text-slate-300 hover:text-slate-100';
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-40 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Mobile Menu */}
      <div className="fixed inset-y-0 left-0 w-full max-w-sm bg-slate-900 border-r border-slate-800 z-50 lg:hidden animate-slide-down">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-800">
            <Link 
              to="/" 
              className="text-xl font-semibold tracking-tight text-slate-100"
              onClick={onClose}
            >
              Wata-Board
            </Link>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              aria-label="Close menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 p-4">
            <div className="space-y-2">
              <Link
                to="/"
                className={`block px-4 py-3 rounded-lg text-base font-medium transition-colors ${isActive('/')}`}
                onClick={onClose}
              >
                Pay Bill
              </Link>
              <Link
                to="/about"
                className={`block px-4 py-3 rounded-lg text-base font-medium transition-colors ${isActive('/about')}`}
                onClick={onClose}
              >
                About
              </Link>
              <Link
                to="/contact"
                className={`block px-4 py-3 rounded-lg text-base font-medium transition-colors ${isActive('/contact')}`}
                onClick={onClose}
              >
                Contact
              </Link>
              <Link
                to="/rate"
                className={`block px-4 py-3 rounded-lg text-base font-medium transition-colors ${isActive('/rate')}`}
                onClick={onClose}
              >
                Rate Us
              </Link>
            </div>
          </nav>

          {/* Network Switcher */}
          <div className="p-4 border-t border-slate-800">
            <div className="flex items-center justify-center">
              <NetworkSwitcher showLabel={true} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MobileNavigation;
