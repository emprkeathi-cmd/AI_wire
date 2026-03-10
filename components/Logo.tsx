
import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
  color?: string; // Hex or tailwind color name
}

export const Logo: React.FC<LogoProps> = ({ size = 48, className = "", color = "#8B5CF6" }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <radialGradient id="coreGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white" />
            <stop offset="40%" stopColor={color} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>

        {/* Outer Orbitals */}
        <circle cx="50" cy="50" r="40" stroke={color} strokeWidth="0.5" strokeDasharray="10 5" opacity="0.3">
          <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="20s" repeatCount="indefinite" />
        </circle>
        <circle cx="50" cy="50" r="32" stroke={color} strokeWidth="1" strokeDasharray="5 15" opacity="0.5">
          <animateTransform attributeName="transform" type="rotate" from="360 50 50" to="0 50 50" dur="15s" repeatCount="indefinite" />
        </circle>

        {/* Neural Nodes */}
        <g opacity="0.8">
          <circle cx="50" cy="18" r="3" fill={color} />
          <circle cx="82" cy="50" r="3" fill={color} />
          <circle cx="50" cy="82" r="3" fill={color} />
          <circle cx="18" cy="50" r="3" fill={color} />
          <path d="M50 18 L82 50 L50 82 L18 50 Z" stroke={color} strokeWidth="0.5" />
        </g>

        {/* Pulsing Core */}
        <circle cx="50" cy="50" r="12" fill="url(#coreGradient)" filter="url(#glow)">
          <animate attributeName="r" values="10;14;10" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;1;0.6" dur="3s" repeatCount="indefinite" />
        </circle>

        {/* Digital "W" wires */}
        <path d="M35 45 L42 65 L50 50 L58 65 L65 45" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
};
