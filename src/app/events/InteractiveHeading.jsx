'use client';

import React from 'react';

/**
 * InteractiveHeading
 *
 * Renders the section heading where letters dynamically turn vibrant yellow
 * under cursor hover/proximity while maintaining a crisp green base color.
 */
const InteractiveHeading = ({ text = 'SPORTING EVENTS', className = '' }) => {
  return (
    <h1
      className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight select-none flex flex-wrap gap-x-4 sm:gap-x-5 leading-none uppercase ${className}`}
      style={{
        fontFamily: "'Montserrat', sans-serif",
        fontWeight: 800,
      }}
    >
      {text.split(' ').map((word, wIdx) => (
        <span key={wIdx} className="inline-flex whitespace-nowrap">
          {word.split('').map((char, cIdx) => (
            <span
              key={cIdx}
              className="inline-block transition-colors duration-100 ease-out text-[#122819] hover:text-[#185B1D] cursor-default"
              style={{
                textShadow: '0 2px 8px rgba(255, 179, 0, 1)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textShadow =
                  '0 0 16px rgba(255, 242, 0, 1), 0 0 30px rgba(30, 244, 44, 0.83)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textShadow = '0 2px 8px rgba(0,0,0,0.15)';
              }}
            >
              {char}
            </span>
          ))}
        </span>
      ))}
    </h1>
  );
};

export default InteractiveHeading;
