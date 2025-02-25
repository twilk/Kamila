import React from 'react';

/**
 * Progress bar component with percentage display
 * @param {Object} props Component props
 * @param {number} props.value Current value
 * @param {number} props.max Maximum value
 * @param {string} [props.className] Additional CSS classes
 */
function ProgressBar({ value, max, className = '' }) {
  const percentage = Math.round((value / max) * 100);
  
  return (
    <div className={`progress-wrapper ${className}`}>
      <div 
        className="progress h-2 bg-gray-200 rounded overflow-hidden"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin="0"
        aria-valuemax={max}
      >
        <div 
          className="progress-bar h-full bg-blue-600 transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-sm text-gray-600 mt-1">
        {percentage}%
      </div>
    </div>
  );
}

export default ProgressBar; 