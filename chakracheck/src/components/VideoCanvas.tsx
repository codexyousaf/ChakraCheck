import React, { useEffect, useRef } from 'react';
import { PostureCategory } from '../services/AlertManager';

const POSE_CONNECTIONS = [
  [11, 12], // left shoulder to right shoulder
  [11, 13], // left shoulder to left elbow
  [13, 15], // left elbow to left wrist
  [12, 14], // right shoulder to right elbow
  [14, 16], // right elbow to right wrist
  [11, 23], // left shoulder to left hip
  [12, 24], // right shoulder to right hip
  [23, 24], // left hip to right hip
  [23, 25], // left hip to left knee
  [25, 27], // left knee to left ankle
  [24, 26], // right hip to right knee
  [26, 28], // right knee to right ankle
];

const COLORS: Record<PostureCategory, string> = {
  Good: '#10B981', // green
  Warning: '#F59E0B', // yellow
  Bad: '#EF4444', // red
};

const NO_POSE_THRESHOLD_MS = 3000;

interface VideoCanvasProps {
  landmarks: any[] | null;
  postureCategory: PostureCategory | null;
  isActive: boolean;
}

export const VideoCanvas: React.FC<VideoCanvasProps> = ({
  landmarks,
  postureCategory,
  isActive,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPoseTimeRef = useRef<number>(0);
  const latestLandmarksRef = useRef<any[] | null>(null);
  const latestCategoryRef = useRef<PostureCategory | null>(null);

  // Update refs when props change (not in the draw loop)
  latestLandmarksRef.current = landmarks;
  latestCategoryRef.current = postureCategory;

  // Initialize lastPoseTimeRef when component mounts
  useEffect(() => {
    lastPoseTimeRef.current = Date.now();
  }, []);

  // Update lastPoseTime when landmarks ARE present (pose detected)
  // This ref only refreshes while a pose is continuously detected
  useEffect(() => {
    if (landmarks && landmarks.length > 0) {
      lastPoseTimeRef.current = Date.now();
    }
  }, [landmarks]);

  useEffect(() => {
    if (!isActive || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    const draw = () => {
      if (!video || !canvas || !ctx) return;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const currentLandmarks = latestLandmarksRef.current;
      const currentCategory = latestCategoryRef.current;

      if (currentLandmarks && currentLandmarks.length > 0) {
        const color = currentCategory ? COLORS[currentCategory] : COLORS['Good'];

        // Draw skeleton connections
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        POSE_CONNECTIONS.forEach(([startIdx, endIdx]) => {
          const startLandmark = currentLandmarks[startIdx];
          const endLandmark = currentLandmarks[endIdx];

          if (startLandmark && endLandmark) {
            ctx.beginPath();
            ctx.moveTo(startLandmark.x * canvas.width, startLandmark.y * canvas.height);
            ctx.lineTo(endLandmark.x * canvas.width, endLandmark.y * canvas.height);
            ctx.stroke();
          }
        });

        // Draw landmarks as circles
        ctx.fillStyle = color;
        currentLandmarks.forEach((landmark) => {
          if (landmark) {
            const x = landmark.x * canvas.width;
            const y = landmark.y * canvas.height;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }

      requestAnimationFrame(draw);
    };

    const animationId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isActive]); // Only depend on isActive - loop starts once per session

  // Only show Reposition when isActive AND no pose detected for 3+ seconds
  const showRepositionMessage = isActive && Date.now() - lastPoseTimeRef.current > NO_POSE_THRESHOLD_MS;

  return (
    <div className="relative inline-block">
      <video
        ref={videoRef}
        width={640}
        height={480}
        muted
        playsInline
        className="rounded-lg shadow-lg"
        style={{ transform: 'scaleX(-1)' }}
      />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="absolute top-0 left-0 rounded-lg"
        style={{ transform: 'scaleX(-1)' }}
      />
      {showRepositionMessage && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-center p-4">
          <div className="bg-black/70 px-4 py-2 rounded-lg">
            <p className="text-lg font-semibold">Reposition</p>
            <p className="text-sm">Please get back in frame</p>
          </div>
        </div>
      )}
    </div>
  );
};
