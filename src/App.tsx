import { useState, useEffect, useRef, useCallback } from 'react';
import { PoseDetectionService, CameraError, CameraErrorType } from './services/PoseDetectionService';
import { PostureScorer } from './services/PostureScorer';
import { AlertManager } from './services/AlertManager';
import { VideoCanvas } from './components/VideoCanvas';
import { ScoreDisplay } from './components/ScoreDisplay';
import { ControlPanel } from './components/ControlPanel';
import { Alert } from './components/Alert';

function App() {
  const [isActive, setIsActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [currentPosture, setCurrentPosture] = useState<import('./services/PostureScorer').PostureState | null>(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [landmarks, setLandmarks] = useState<any[] | null>(null);

  const poseDetectionService = useRef<PoseDetectionService | null>(null);
  const postureScorer = useRef<PostureScorer | null>(null);
  const alertManager = useRef<AlertManager | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animationFrameId = useRef<number | null>(null);
  const lastScoreUpdateRef = useRef<number>(0);

  // Initialize services on mount
  useEffect(() => {
    poseDetectionService.current = new PoseDetectionService();
    postureScorer.current = new PostureScorer({ alpha: 0.3 });
    alertManager.current = new AlertManager({ badPostureThresholdMs: 8000, gracePeriodMs: 2000 });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (poseDetectionService.current?.isDetecting()) {
        poseDetectionService.current.stopDetection();
      }
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  // Handle camera errors
  const handleCameraError = useCallback((error: CameraError) => {
    console.error('Camera error:', error);
    let message = 'Camera error';
    switch (error.type) {
      case CameraErrorType.DENIED:
        message = 'Camera permission denied. Please enable camera access.';
        break;
      case CameraErrorType.NOT_FOUND:
        message = 'No camera found. Please connect a camera and try again.';
        break;
      default:
        message = `Camera error: ${error.message}`;
    }
    setCameraError(message);
    setIsActive(false);
  }, []);

  // Start button handler
  const handleStart = useCallback(async () => {
    if (!poseDetectionService.current) {
      setCameraError('Pose detection service not initialized');
      return;
    }

    setCameraError(null);
    setIsActive(true);

    try {
      await poseDetectionService.current.initialize('/pose_landmarker_lite.task');

      if (videoRef.current) {
        poseDetectionService.current.startDetection(
          videoRef.current,
          (detectedLandmarks, timestamp) => {
            // Update landmarks state
            if (detectedLandmarks) {
              setLandmarks(detectedLandmarks);

              // Update posture score every 1-2 seconds to reduce jitter
              if (timestamp - lastScoreUpdateRef.current > 1000) {
                if (postureScorer.current) {
                  const postureState = postureScorer.current.update(detectedLandmarks);
                  setCurrentPosture(postureState);

                  // Update alert status
                  if (alertManager.current) {
                    const result = alertManager.current.update(
                      postureState.category,
                      timestamp
                    );
                    setAlertVisible(result.visible);
                  }
                }

                lastScoreUpdateRef.current = timestamp;
              }
            }
          }
        );
      }
    } catch (error) {
      if (error instanceof CameraError) {
        handleCameraError(error);
      } else {
        setCameraError(`Failed to start: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setIsActive(false);
      }
    }
  }, [handleCameraError]);

  // Stop button handler
  const handleStop = useCallback(() => {
    if (poseDetectionService.current?.isDetecting()) {
      poseDetectionService.current.stopDetection();
    }
    setIsActive(false);
    setCameraError(null);
    setCurrentPosture(null);
    setAlertVisible(false);
    setLandmarks(null);
    if (lastScoreUpdateRef.current) {
      lastScoreUpdateRef.current = 0;
    }
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
  }, []);

  // Handle alert dismissal
  const handleDismissAlert = useCallback(() => {
    if (alertManager.current) {
      alertManager.current.forceClear();
      setAlertVisible(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">ChakraCheck</h1>
          <p className="text-gray-600 mt-2">AI-powered posture monitoring</p>
        </header>

        {/* Error display */}
        {cameraError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {cameraError}
          </div>
        )}

        {/* Video canvas and score display */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="flex justify-center">
            <VideoCanvas
              ref={videoRef}
              landmarks={landmarks}
              postureCategory={currentPosture?.category ?? null}
              isActive={isActive}
            />
          </div>
          <div className="flex items-center justify-center">
            <ScoreDisplay
              score={currentPosture?.score ?? null}
              category={currentPosture?.category ?? null}
            />
          </div>
        </div>

        {/* Control panel */}
        <div className="flex justify-center mb-6">
          <ControlPanel
            isActive={isActive}
            onStart={handleStart}
            onStop={handleStop}
          />
        </div>

        {/* Alert modal */}
        <Alert visible={alertVisible} onDismiss={handleDismissAlert} />
      </div>
    </div>
  );
}

export default App;