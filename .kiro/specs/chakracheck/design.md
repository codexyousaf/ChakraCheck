# Design Document: ChakraCheck (MVP)

## Overview

ChakraCheck is a client-side web application that provides real-time posture monitoring for programmers using webcam-based pose detection. The application uses MediaPipe Pose for landmark detection, calculates posture quality scores, and provides visual feedback with alerts for sustained poor posture.

**Technology Stack:**
- **Frontend Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **Pose Detection:** MediaPipe Pose Tasks API (@mediapipe/tasks-vision)
- **Deployment:** Static site (Netlify/Vercel)

**Architecture Pattern:** Service-based architecture with React components as presentation layer.

## System Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────┐
│              React Application                  │
├─────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │   App    │  │VideoCanvas│  │ScoreDisplay  │  │
│  │Component │  │ Component │  │  Component   │  │
│  └────┬─────┘  └────┬──────┘  └──────┬───────┘  │
│       │             │                │          │
│  ┌────┴─────────────┴────────────────┴───────┐  │
│  │        ControlPanel Component             │  │
│  └───────────────────┬────────────────────────┘  │
└──────────────────────┼─────────────────────────┘
                       │
┌──────────────────────┼─────────────────────────┐
│         Service Layer │                         │
├───────────────────────┴─────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌───────┐ │
│  │PoseDetection │  │   Posture    │  │ Alert │ │
│  │   Service    │→│    Scorer     │→│Manager│ │
│  └──────────────┘  └──────────────┘  └───────┘ │
└─────────────────────────────────────────────────┘
```

### Component Responsibilities

**React Components (Presentation Layer):**
- `App`: Root component, orchestrates application state and service coordination
- `VideoCanvas`: Renders live video feed with pose skeleton overlay
- `ScoreDisplay`: Shows current posture score, category, and color-coded status
- `ControlPanel`: Start/Stop buttons and privacy notice
- `Alert`: Modal/toast component for sustained bad posture warnings

**Service Layer (Business Logic):**
- `PoseDetectionService`: Manages MediaPipe Pose lifecycle, processes video frames, extracts landmarks
- `PostureScorer`: Calculates posture score from landmarks (forward-head angle + shoulder symmetry)
- `AlertManager`: Tracks posture category duration, triggers alerts at 8-second threshold

## Data Flow

1. **Initialization:**
   - User clicks Start → `App` initializes `PoseDetectionService`
   - `PoseDetectionService` requests webcam access, loads MediaPipe Pose model
   - Video stream starts → frames sent to `VideoCanvas`

2. **Detection Loop (15-30 fps):**
   - `PoseDetectionService` processes video frame
   - Extracts pose landmarks → passes to `PostureScorer`
   - `PostureScorer` calculates score (0-100) → returns score + category
   - Score/category → `App` state → `ScoreDisplay` and `VideoCanvas` (for overlay color)
   - Score/category → `AlertManager` to track duration

3. **Alert Triggering:**
   - `AlertManager` monitors "Bad" posture duration
   - If ≥8 seconds → triggers alert → `App` shows `Alert` component
   - When posture improves → alert clears

4. **Shutdown:**
   - User clicks Stop → `App` stops `PoseDetectionService`
   - Webcam released, resources cleaned up

## Core Algorithms

### 1. Pose Landmark Detection

**Uses:** MediaPipe Pose Tasks API

**Implementation:**
```typescript
// PoseDetectionService.processFrame()
const detections = await poseLandmarker.detectForVideo(videoElement, timestamp);
if (detections.landmarks && detections.landmarks.length > 0) {
  const landmarks = detections.landmarks[0]; // First person detected
  return landmarks; // 33 pose landmarks with x, y, z coordinates
}
return null; // No pose detected
```

**Key Landmarks (MediaPipe indices):**
- Nose: 0
- Left/Right Eye: 1, 2
- Left/Right Ear: 7, 8
- Left/Right Shoulder: 11, 12
- Left/Right Hip: 23, 24

### 2. Posture Score Calculation

**Algorithm:** Weighted combination of forward-head angle and shoulder symmetry

**Forward-Head Angle (70% weight):**
```typescript
// Calculate angle between vertical line and head-to-shoulder line
const nose = landmarks[0];
const midShoulder = midpoint(landmarks[11], landmarks[12]);
const midHip = midpoint(landmarks[23], landmarks[24]);

// Vector from hips to shoulders (ideal spine)
const spineVector = { x: midShoulder.x - midHip.x, y: midShoulder.y - midHip.y };

// Vector from shoulders to nose (actual head position)
const headVector = { x: nose.x - midShoulder.x, y: nose.y - midShoulder.y };

// Angle between vectors
const angle = angleBetween(spineVector, headVector);

// Convert to score: 0° = 100, 45° = 0
const forwardHeadScore = Math.max(0, 100 - (angle / 45) * 100);
```

**Shoulder Symmetry (30% weight):**
```typescript
// Measure horizontal difference between shoulders
const leftShoulder = landmarks[11];
const rightShoulder = landmarks[12];

const heightDiff = Math.abs(leftShoulder.y - rightShoulder.y);
const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);

// Normalize by shoulder width (wider shoulders = more tolerance)
const asymmetryRatio = heightDiff / shoulderWidth;

// Convert to score: 0 = 100, 0.2 = 0
const shoulderScore = Math.max(0, 100 - (asymmetryRatio / 0.2) * 100);
```

**Final Score:**
```typescript
const postureScore = Math.round(forwardHeadScore * 0.7 + shoulderScore * 0.3);
```

**Smoothing:** Apply exponential moving average (α = 0.3) to reduce jitter:
```typescript
smoothedScore = α * newScore + (1 - α) * previousScore;
```

### 3. Posture Categorization

**Simple threshold-based classification:**
```typescript
function categorizePosture(score: number): PostureCategory {
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Warning';
  return 'Bad';
}
```

### 4. Alert Management

**State Machine:**
```
[Good/Warning] → [Bad] → start timer
  ↓                ↓
  ├─ reset timer   ├─ timer < 8s: no alert
  └─ clear alert   └─ timer ≥ 8s: trigger alert

[Bad with alert] → [Good/Warning] → clear alert after 2s grace period
```

**Implementation:**
```typescript
class AlertManager {
  private badPostureStartTime: number | null = null;
  private alertActive = false;
  
  update(category: PostureCategory, currentTime: number): boolean {
    if (category === 'Bad') {
      if (this.badPostureStartTime === null) {
        this.badPostureStartTime = currentTime;
      }
      const duration = currentTime - this.badPostureStartTime;
      if (duration >= 8000 && !this.alertActive) {
        this.alertActive = true;
        return true; // Trigger alert
      }
    } else {
      // Good or Warning
      if (this.alertActive) {
        // Grace period: wait 2s before clearing
        setTimeout(() => this.clearAlert(), 2000);
      }
      this.badPostureStartTime = null;
    }
    return false;
  }
  
  clearAlert() {
    this.alertActive = false;
  }
}
```

## Data Structures

### Pose Landmarks
```typescript
interface PoseLandmark {
  x: number;      // Normalized [0, 1] in image coordinates
  y: number;      // Normalized [0, 1] in image coordinates
  z: number;      // Depth (not used in MVP)
  visibility: number; // Confidence [0, 1]
}

type PoseLandmarks = PoseLandmark[]; // 33 landmarks
```

### Posture State
```typescript
interface PostureState {
  score: number;           // 0-100
  category: 'Good' | 'Warning' | 'Bad';
  forwardHeadAngle: number; // degrees
  shoulderAsymmetry: number; // ratio
  timestamp: number;
}
```

### Application State (React)
```typescript
interface AppState {
  isActive: boolean;
  cameraError: string | null;
  currentPosture: PostureState | null;
  alertVisible: boolean;
  landmarks: PoseLandmarks | null;
}
```

## UI/UX Design

### Layout (Single Page)
```
┌─────────────────────────────────────────────────┐
│  ChakraCheck                      [Stop Button] │ ← Header
├─────────────────────────────────────────────────┤
│                                                 │
│   ┌──────────────────────────────────────┐     │
│   │                                      │     │
│   │     Video Feed + Pose Overlay        │     │
│   │     (640x480, mirrored)              │     │
│   │                                      │     │
│   └──────────────────────────────────────┘     │
│                                                 │
│   ┌────────────────────────────────────────┐   │
│   │  Score: 85  │  Category: Good 🟢      │   │ ← Score Display
│   └────────────────────────────────────────┘   │
│                                                 │
│   [Start Monitoring]  [Stop Monitoring]        │ ← Control Panel
│                                                 │
│   🔒 Privacy: All processing is local. No      │
│      data leaves your device.                  │
└─────────────────────────────────────────────────┘

         ┌─────────────────────────┐
         │  ⚠️ Poor Posture Alert  │ ← Alert Modal (when triggered)
         │                         │
         │  Straighten your back   │
         │  and level your head.   │
         │                         │
         │      [Dismiss]          │
         └─────────────────────────┘
```

### Visual Feedback
- **Score Display:** Large, bold number with color coding
  - Green (#10B981): Score ≥80
  - Yellow (#F59E0B): Score 60-79
  - Red (#EF4444): Score <60

- **Pose Overlay:** Skeleton drawn on video canvas
  - Connections: shoulders, spine, hips
  - Color matches current category
  - Circles at key landmarks (nose, shoulders, hips)

- **Alert Modal:**
  - Semi-transparent overlay
  - Center of screen, above video
  - Short correction tip
  - Dismiss button (auto-dismisses when posture improves)

### Responsive Behavior
- Desktop-first (MVP targets programmers at desks)
- Video canvas: max-width 640px, scales down on smaller screens
- Controls: horizontal on desktop, stack on mobile

## Error Handling

### Camera Access Denied
```typescript
try {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
} catch (error) {
  if (error.name === 'NotAllowedError') {
    showError('Camera access denied. Please allow camera access and try again.');
  } else if (error.name === 'NotFoundError') {
    showError('No camera found. Please connect a camera and try again.');
  } else {
    showError('Failed to access camera. Please check your browser settings.');
  }
}
```

### No Pose Detected
- If no landmarks detected for >3 seconds:
  - Show "Reposition" message on video overlay
  - Freeze score at last valid value
  - Don't update alert state

### Model Load Failure
```typescript
try {
  await PoseLandmarker.createFromOptions(vision, options);
} catch (error) {
  showError('Failed to load pose detection model. Please refresh the page.');
}
```

## Performance Considerations

### Frame Rate Management
- Target: 15-30 fps (balance between responsiveness and CPU usage)
- Use `requestAnimationFrame` for processing loop
- Skip frames if processing takes >33ms (30fps threshold)

### Model Configuration
```typescript
const options = {
  baseOptions: {
    modelAssetPath: 'pose_landmarker_lite.task', // Lite model for MVP
    delegate: 'GPU' // Use GPU acceleration if available
  },
  runningMode: 'VIDEO',
  numPoses: 1, // Only detect first person
  minPoseDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
};
```

### Memory Management
- Dispose MediaPipe resources on component unmount
- Stop video stream when not in use
- Clear intervals/timeouts on cleanup

## Browser Compatibility

**MVP Target:** Modern Chrome/Edge (Chromium-based)

**Required APIs:**
- `getUserMedia` (webcam access)
- WebAssembly (for MediaPipe)
- Canvas 2D API (for rendering)
- ES2020+ features (async/await, optional chaining)

**Minimum Versions:**
- Chrome 94+
- Edge 94+
- Firefox 90+ (not officially tested for MVP)
- Safari 15+ (not officially tested for MVP)

## Privacy & Security

### Data Handling
- **No server communication:** All processing happens in the browser
- **No persistent storage:** No localStorage, no cookies, no IndexedDB
- **No analytics:** No tracking scripts, no telemetry
- **In-memory only:** All data cleared on page refresh or close

### User Transparency
- Display privacy notice prominently
- Clear messaging: "All processing is local. No data leaves your device."
- Immediate camera release on Stop

## Testing Strategy (MVP)

### Manual Smoke Tests
1. **Camera Start Test:**
   - Click Start → verify camera activates
   - Verify video feed displays
   - Verify pose overlay appears when user in frame

2. **Score Update Test:**
   - Sit with good posture → verify score 80-100, green category
   - Lean forward significantly → verify score <60, red category, alert after 8s
   - Return to good posture → verify alert clears

### Out of Scope (Not in MVP)
- Unit tests for scoring algorithms
- Property-based tests
- Cross-browser automated testing
- Performance benchmarks
- Accessibility audits

## Deployment

### Build Configuration (Vite)
```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  base: '/', // Adjust for subdirectory deployment if needed
  build: {
    outDir: 'dist',
    sourcemap: false, // No sourcemaps for MVP
    rollupOptions: {
      output: {
        manualChunks: {
          'mediapipe': ['@mediapipe/tasks-vision']
        }
      }
    }
  }
});
```

### Static Site Hosting
- **Recommended:** Netlify or Vercel
- **Requirements:**
  - HTTPS (required for getUserMedia)
  - Support for SPA routing (fallback to index.html)
  - Serve `.task` files with correct MIME type (application/octet-stream)

### Build Output
```bash
npm run build
# Creates dist/ folder with:
# - index.html
# - assets/index-[hash].js (React app)
# - assets/mediapipe-[hash].js (MediaPipe library)
# - pose_landmarker_lite.task (model file)
```

## Correctness Properties

These properties describe the expected behavior of the system. They serve as documentation and rationale for the design, but formal property-based testing is NOT required for the MVP.

### Property 1: Monotonic Posture Degradation
**Statement:** If forward-head angle increases OR shoulder asymmetry increases (and nothing else changes), THEN posture score MUST NOT increase.

**Rationale:** Ensures scoring algorithm responds correctly to worsening posture.

**Validates Requirements:** 2.2 (scoring reflects alignment quality)

---

### Property 2: Category Threshold Consistency
**Statement:** If posture score = 80, category MUST be "Good". If 60 ≤ score < 80, category MUST be "Warning". If score < 60, category MUST be "Bad".

**Rationale:** Ensures category boundaries are deterministic and match requirements.

**Validates Requirements:** 3.1, 3.2, 3.3 (category thresholds)

---

### Property 3: Alert Timing Precision
**Statement:** Alert MUST NOT trigger before 8 seconds of continuous "Bad" posture. Alert MUST trigger within 1 second after 8 seconds of continuous "Bad" posture.

**Rationale:** Prevents false alerts for brief movements and ensures timely warnings.

**Validates Requirements:** 4.2 (8-second threshold)

---

### Property 4: Alert Reset on Improvement
**Statement:** If posture returns to "Good" or "Warning" category, active alert MUST clear within 5 seconds.

**Rationale:** Ensures alerts don't persist after posture correction.

**Validates Requirements:** 4.3 (alert clears on improvement)

---

### Property 5: Camera Resource Cleanup
**Statement:** When Stop is clicked or component unmounts, webcam access MUST be released (MediaStream tracks stopped) and MediaPipe resources MUST be disposed.

**Rationale:** Prevents resource leaks and camera indicator remaining active.

**Validates Requirements:** 1.5 (stop releases resources)

---

### Property 6: Privacy Guarantee (No Network Traffic)
**Statement:** During normal operation, application MUST NOT send any HTTP/WebSocket requests to external servers (excluding initial page load and static assets).

**Rationale:** Validates that all processing is truly client-side.

**Validates Requirements:** 7.1 (no data transmission)

## Future Enhancements (Post-MVP)

1. **Settings Panel:**
   - Adjustable alert threshold (5-15 seconds)
   - Alert volume/style customization
   - Toggle pose overlay visibility
   - Persist settings to localStorage

2. **Accessibility:**
   - Screen reader support for score changes
   - Keyboard shortcuts (Space = Start/Stop)
   - High contrast mode
   - 200% zoom support

3. **Session Tracking:**
   - Total session time
   - Average posture score
   - Number of alerts triggered
   - Daily/weekly trends (with localStorage)

4. **Performance:**
   - Battery-saving mode (lower fps)
   - CPU usage monitoring
   - Thermal throttling detection

5. **Browser Support:**
   - Formal Firefox/Safari testing and certification
   - Polyfills for older browsers
   - Fallback for WebAssembly-unsupported environments

6. **Advanced Posture Analysis:**
   - Eye-level monitoring (screen height correction)
   - Distance from screen (forward lean magnitude)
   - Break reminders (every 30 minutes)
   - Stretch suggestions

