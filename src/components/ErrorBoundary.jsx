import React from 'react';

/**
 * Error boundary component for handling React errors gracefully
 */
class ErrorBoundary extends React.Component {
  state = { 
    hasError: false, 
    error: null 
  };
  
  static getDerivedStateFromError(error) {
    return { 
      hasError: true, 
      error 
    };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-lg font-semibold text-red-700 mb-2">
            Something went wrong
          </h3>
          <p className="text-red-600 mb-4">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}

export default ErrorBoundary; 