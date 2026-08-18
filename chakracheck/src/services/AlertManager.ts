export type PostureCategory = 'Good' | 'Warning' | 'Bad';

export interface AlertState {
  visible: boolean;
  triggeredAt: number | null;
  improvedAt: number | null;
  badPostureDuration: number;
}

export interface UpdateResult {
  visible: boolean;
  alertJustTriggered: boolean;
  alertJustCleared: boolean;
}

export interface AlertConfig {
  badPostureThresholdMs: number;
  gracePeriodMs: number;
}

const DEFAULT_CONFIG: AlertConfig = {
  badPostureThresholdMs: 8000, // 8 seconds
  gracePeriodMs: 2000, // 2 seconds
};

export class AlertManager {
  private badPostureThresholdMs: number;
  private gracePeriodMs: number;
  private alertState: AlertState = {
    visible: false,
    triggeredAt: null,
    improvedAt: null,
    badPostureDuration: 0,
  };

  constructor(config: Partial<AlertConfig> = {}) {
    this.badPostureThresholdMs = config.badPostureThresholdMs ?? DEFAULT_CONFIG.badPostureThresholdMs;
    this.gracePeriodMs = config.gracePeriodMs ?? DEFAULT_CONFIG.gracePeriodMs;
  }

  /**
   * Update alert state based on current posture category
   * @param category Current posture category ('Good', 'Warning', 'Bad')
   * @param timestamp Current timestamp in milliseconds
   * @returns UpdateResult with alert visibility and status flags
   */
  update(category: PostureCategory, timestamp: number): UpdateResult {
    const previousVisible = this.alertState.visible;
    let alertJustTriggered = false;
    let alertJustCleared = false;

    if (category === 'Bad') {
      // Track bad posture duration
      if (this.alertState.triggeredAt === null) {
        this.alertState.triggeredAt = timestamp;
      }

      this.alertState.badPostureDuration = timestamp - this.alertState.triggeredAt;

      // Trigger alert if threshold reached
      if (!this.alertState.visible && this.alertState.badPostureDuration >= this.badPostureThresholdMs) {
        this.alertState.visible = true;
        alertJustTriggered = true;
        this.alertState.improvedAt = null;
      }
    } else {
      // Good or Warning - check for improvement
      if (this.alertState.visible) {
        if (this.alertState.improvedAt === null) {
          this.alertState.improvedAt = timestamp;
        }

        const improvementDuration = timestamp - this.alertState.improvedAt;

        // Clear alert after grace period if posture improved
        if (improvementDuration >= this.gracePeriodMs) {
          this.alertState.visible = false;
          alertJustCleared = true;
          // Reset tracking after grace period elapses
          this.alertState.triggeredAt = null;
          this.alertState.badPostureDuration = 0;
          this.alertState.improvedAt = null;
        }
      } else if (!this.alertState.visible) {
        // No active alert - reset tracking
        this.alertState.triggeredAt = null;
        this.alertState.badPostureDuration = 0;
        this.alertState.improvedAt = null;
      }
    }

    return {
      visible: this.alertState.visible,
      alertJustTriggered,
      alertJustCleared,
    };
  }

  /**
   * Get current alert state
   */
  getState(): AlertState {
    return { ...this.alertState };
  }

  /**
   * Reset alert manager to initial state
   */
  reset(): void {
    this.alertState = {
      visible: false,
      triggeredAt: null,
      improvedAt: null,
      badPostureDuration: 0,
    };
  }

  /**
   * Force clear alert (useful when user dismisses manually)
   */
  forceClear(): void {
    this.alertState.visible = false;
    this.alertState.triggeredAt = null;
    this.alertState.badPostureDuration = 0;
    this.alertState.improvedAt = null;
  }
}
