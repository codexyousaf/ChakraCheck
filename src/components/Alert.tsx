import React from 'react';

interface AlertProps {
  visible: boolean;
  onDismiss: () => void;
}

export const Alert: React.FC<AlertProps> = ({ visible, onDismiss }) => {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onDismiss}
      />
      <div className="relative bg-white rounded-lg shadow-2xl max-w-md w-full mx-4 p-6 animate-in fade-in zoom-in duration-300">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-shrink-0 text-4xl">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900">Bad Posture Detected</h2>
        </div>
        <p className="text-gray-600 mb-6">
          Straighten your back and level your head
        </p>
        <button
          onClick={onDismiss}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};