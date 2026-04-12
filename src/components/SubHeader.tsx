import React from 'react';
import './SubHeader.css';

interface SubHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const SubHeader: React.FC<SubHeaderProps> = ({ children, className = '' }) => {
  return (
    <div className={`sub-header ${className}`}>
      <div className="sub-header-blur" />
      <div className="sub-header-content">
        {children}
      </div>
    </div>
  );
};
