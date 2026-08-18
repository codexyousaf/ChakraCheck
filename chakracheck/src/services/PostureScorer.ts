import { PoseLandmarks } from '../types/mediapipe';

export interface PostureState {
  score: number;
  category: 'Good' | 'Warning' | 'Bad';
  forwardHeadAngle: number;
  shoulderSymmetry: number;
  timestamp: number;
}

export interface ScoringConfig {
  alpha: number; // EMA smoothing factor
  goodThreshold: number;
  warningThreshold: number;
}

const DEFAULT_CONFIG: ScoringConfig = {
  alpha: 0.3,
  goodThreshold: 80,
  warningThreshold: 60,
};

export class PostureScorer {
  private alpha: number;
  private goodThreshold: number;
  private warningThreshold: number;
  private smoothedScore: number | null = null;

  constructor(config: Partial<ScoringConfig> = {}) {
    this.alpha = config.alpha ?? DEFAULT_CONFIG.alpha;
    this.goodThreshold = config.goodThreshold ?? DEFAULT_CONFIG.goodThreshold;
    this.warningThreshold = config.warningThreshold ?? DEFAULT_CONFIG.warningThreshold;
  }

  /**
   * Calculate the forward head angle
   * Measures how much the head is leaning forward relative to the spine
   * @param landmarks Pose landmarks
   * @returns Angle in degrees (0 = upright, higher = more forward)
   */
  calculateForwardHeadAngle(landmarks: PoseLandmarks): number {
    // Use shoulder mid-point as reference and nose position
    const leftShoulder = landmarks[11]; // LEFT_SHOULDER
    const rightShoulder = landmarks[12]; // RIGHT_SHOULDER
    const nose = landmarks[0]; // NOSE

    if (!leftShoulder || !rightShoulder || !nose) {
      return 0;
    }

    // Calculate shoulder midpoint
    const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
    const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;

    // Calculate vector from shoulder midpoint to nose
    const dx = nose.x - shoulderMidX;
    const dy = nose.y - shoulderMidY;

    // Calculate angle in degrees (positive = forward lean)
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    // Normalize to 0-180 range (forward lean is positive)
    let normalizedAngle = angle + 90; // Adjust so upright is ~0
    if (normalizedAngle < 0) normalizedAngle = 0;
    if (normalizedAngle > 180) normalizedAngle = 180;

    return normalizedAngle;
  }

  /**
   * Calculate shoulder symmetry score
   * Measures height difference between shoulders normalized by shoulder width
   * @param landmarks Pose landmarks
   * @returns Score from 0 (highly asymmetrical) to 1 (symmetrical)
   */
  calculateShoulderSymmetry(landmarks: PoseLandmarks): number {
    const leftShoulder = landmarks[11]; // LEFT_SHOULDER
    const rightShoulder = landmarks[12]; // RIGHT_SHOULDER

    if (!leftShoulder || !rightShoulder) {
      return 0;
    }

    // Calculate height difference
    const heightDiff = Math.abs(leftShoulder.y - rightShoulder.y);

    // Calculate shoulder width
    const width = Math.abs(leftShoulder.x - rightShoulder.x);

    // Normalize by width (avoid division by zero)
    const normalizedDiff = width > 0.01 ? heightDiff / width : 0;

    // Convert to score (0 = asymmetrical, 1 = symmetrical)
    // Using exponential decay: score = e^(-k * normalizedDiff)
    const k = 3; // Tuning parameter
    const score = Math.exp(-k * normalizedDiff);

    return score;
  }

  /**
   * Calculate the weighted posture score
   * 70% forward-head angle + 30% shoulder symmetry
   * @param landmarks Pose landmarks
   * @returns Score from 0-100
   */
  calculateScore(landmarks: PoseLandmarks): number {
    const forwardHeadAngle = this.calculateForwardHeadAngle(landmarks);
    const shoulderSymmetry = this.calculateShoulderSymmetry(landmarks);

    // Convert forward head angle to score (0-100)
    // 0 degrees = 100 points, 30 degrees = 0 points
    const forwardHeadScore = Math.max(0, 100 - (forwardHeadAngle * (100 / 30)));

    // Weighted combination
    const score = (forwardHeadScore * 0.7) + (shoulderSymmetry * 100 * 0.3);

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /**
   * Get posture category based on score
   * @param score Posture score (0-100)
   * @returns Category: 'Good', 'Warning', or 'Bad'
   */
  categorizePosture(score: number): 'Good' | 'Warning' | 'Bad' {
    if (score >= this.goodThreshold) {
      return 'Good';
    } else if (score >= this.warningThreshold) {
      return 'Warning';
    } else {
      return 'Bad';
    }
  }

  /**
   * Update scorer with new landmarks and return smoothed posture state
   * @param landmarks Pose landmarks
   * @returns PostureState with score and category
   */
  update(landmarks: PoseLandmarks): PostureState {
    const rawScore = this.calculateScore(landmarks);

    // Apply exponential moving average
    if (this.smoothedScore === null) {
      this.smoothedScore = rawScore;
    } else {
      this.smoothedScore = this.alpha * rawScore + (1 - this.alpha) * this.smoothedScore;
    }

    const category = this.categorizePosture(this.smoothedScore);

    return {
      score: Math.round(this.smoothedScore),
      category,
      forwardHeadAngle: this.calculateForwardHeadAngle(landmarks),
      shoulderSymmetry: this.calculateShoulderSymmetry(landmarks),
      timestamp: Date.now(),
    };
  }

  /**
   * Reset the scorer state
   */
  reset(): void {
    this.smoothedScore = null;
  }
}
