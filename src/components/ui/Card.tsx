import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  hoverEffect = false 
}) => {
  return (
    <div 
      className={`
        bg-netflix-black-light/80 backdrop-blur-md 
        border border-gray-800/50 rounded-xl p-6
        ${hoverEffect ? 'hover:bg-netflix-gray-dark/50 transition-all duration-300 hover:scale-[1.01] hover:border-gray-700' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};
