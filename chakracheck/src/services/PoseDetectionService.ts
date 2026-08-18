import {
  PoseLandmarker,
  PoseLandmarkerResult,
  createPoseLandmarker,
} from '@mediapipe/tasks-vision';
import { PoseLandmarks } from '../types/mediapipe';

export enum CameraErrorType {
  DENIED = 'PERMISSION_DENIED',
  NOT_FOUND = 'NOT_FOUND',
  GENERAL = 'GENERAL',
}

export class CameraError extends Error {
  constructor(public type: CameraErrorType, message: string) {
    super(message);
    this.name = 'CameraError';
  }
}

export class PoseDetectionService {
  private landmarker: PoseLandmarker | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private isRunning = false;
  private animationFrameId: number | null = null;

  /**
   * Initialize the PoseLandmarker with the model file
   * @param modelPath Path to the pose landmarker model file
   */
  async initialize(modelPath: string = '/pose_landmarker_lite.task'): Promise<void> {
    this.landmarker = await createPoseLandmarker(modelPath, {
      baseOptions: {
        modelAssetPath: modelPath,
        enableClassification: false,
      },
      runningMode: 'VIDEO',
    });
  }

  /**
   * Start pose detection with a video element
   * @param videoElement The video element to process
   */
  async startDetection(videoElement: HTMLVideoElement): Promise<void> {
    if (!this.landmarker) {
      throw new Error('PoseLandmarker not initialized. Call initialize() first.');
    }

    this.videoElement = videoElement;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      this.stream = stream;
      videoElement.srcObject = stream;
      videoElement.muted = true;
      videoElement.playsInline = true;

      // Wait for video to be ready
      await new Promise<void>((resolve, reject) => {
        videoElement.onloadeddata = () => resolve();
        videoElement.onerror = () => reject(new Error('Video error'));
        videoElement.play().catch(() => resolve()); // Ignore play errors
      });

      this.isRunning = true;
      this.startDetectionLoop();
    } catch (error) {
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          throw new CameraError(CameraErrorType.DENIED, 'Camera permission denied');
        } else if (error.name === 'NotFoundError') {
          throw new CameraError(CameraErrorType.NOT_FOUND, 'No camera found');
        }
      }
      throw new CameraError(CameraErrorType.GENERAL, `Camera error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Stop pose detection and release resources
   */
  stopDetection(): void {
    this.isRunning = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement.load();
      this.videoElement = null;
    }
  }

  /**
   * Process a single frame from the video
   * @param videoElement The video element to process
   * @param timestamp Current timestamp in milliseconds
   * @returns PoseLandmarks or null if no pose detected
   */
  processFrame(videoElement: HTMLVideoElement, timestamp: number): PoseLandmarks | null {
    if (!this.landmarker) {
      return null;
    }

    try {
      const result = this.landmarker.detectForVideo(videoElement, timestamp);

      if (result.poseLandmarks && result.poseLandmarks.length > 0) {
        return result.poseLandmarks[0];
      }

      return null;
    } catch (error) {
      console.error('Error processing frame:', error);
      return null;
    }
  }

  /**
   * Get the current landmarker instance
   */
  getLandmarker(): PoseLandmarker | null {
    return this.landmarker;
  }

  /**
   * Check if detection is currently running
   */
  isDetecting(): boolean {
    return this.isRunning;
  }

  /**
   * Start the detection loop using requestAnimationFrame
   */
  private startDetectionLoop(): void {
    const loop = (timestamp: number) => {
      if (!this.isRunning || !this.videoElement) {
        return;
      }

      // Process frame (caller can call processFrame as needed)
      // This loop keeps the video stream active

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }
}
