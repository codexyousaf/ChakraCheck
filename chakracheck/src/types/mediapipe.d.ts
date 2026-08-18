export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export type PoseLandmarks = PoseLandmark[];

export interface PoseLandmarkerResult {
  poseLandmarks: PoseLandmarks[];
}

export interface LandmarkerResult {
  poseLandmarks: PoseLandmarks;
}
