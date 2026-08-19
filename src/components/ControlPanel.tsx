import React from 'react';

interface ControlPanelProps {
  isActive: boolean;
  onStart: () => void;
  onStop: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ isActive, onStart, onStop }) => {
  return (
    <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-lg shadow-lg border border-gray-200">
      <div className="flex gap-4">
        <button
          onClick={onStart}
          disabled={isActive}
          className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Start
        </button>
        <button
          onClick={onStop}
          disabled={!isActive}
          className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Stop
        </button>
      </div>
      <div className="text-sm text-gray-600 flex items-center gap-2">
        <span>🔒</span>
        <span>All processing is local. No data leaves your device.</span>
      </div>
    </div>
  );
};