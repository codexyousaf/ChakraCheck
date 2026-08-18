# Implementation Plan: ChakraCheck

## Overview

This implementation plan breaks down the ChakraCheck MVP into discrete, actionable tasks for a hackathon build. The application is a browser-based posture monitoring tool using React, TypeScript, Vite, Tailwind CSS, and MediaPipe Pose. All tasks are sized for incremental progress with early validation points.

## Tasks

- [ ] 1. Set up project foundation
  - [-] 1.1 Initialize Vite + React + TypeScript project
    - Run `npm create vite@latest chakracheck -- --template react-ts`
    - Install dependencies: `npm install`
    - Verify dev server starts: `npm run dev`
    - _Requirements: Foundation for 1.1, 6.1_
  
  - [ ] 1.2 Configure Tailwind CSS
    - Install Tailwind: `npm install -D tailwindcss postcss autoprefixer`
    - Initialize config: `npx tailwindcss init -p`
    - Configure content paths in `tailwind.config.js`
    - Add Tailwind directives to `src/index.css`
    - Verify Tailwind classes work in `App.tsx`
    - _Requirements: Foundation for 5.1_
  
  - [ ] 1.3 Install MediaPipe Pose dependencies
    - Install MediaPipe: `npm install @mediapipe/tasks-vision`
    - Download `pose_landmarker_lite.task` model file to `/public` directory
    - Create `src/types/mediapipe.d.ts` for type declarations
    - _Requirements: Foundation for 1.1, 1.3_

- [ ] 2. Implement core service layer
  - [ ] 2.1 Create PoseDetectionService
    - Create `src/services/PoseDetectionService.ts`
    - Implement MediaPipe initialization with model loading
    - Implement `startDetection(videoElement)` to begin processing
    - Implement `processFrame(videoElement, timestamp)` to extract landmarks
    - Implement `stopDetection()` to release resources
    - Handle camera access errors (denied, not found, general failure)
    - Export landmark types: `PoseLandmark[]` (33 landmarks with x, y, z, visibility)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [ ] 2.2 Create PostureScorer service
    - Create `src/services/PostureScorer.ts`
    - Implement forward-head angle calculation (nose → shoulders relative to spine)
    - Implement shoulder symmetry calculation (height difference normalized by width)
    - Implement weighted score: 70% forward-head + 30% shoulder symmetry
    - Implement exponential moving average smoothing (α = 0.3)
    - Implement `categorizePosture(score)`: Good (≥80), Warning (60-79), Bad (<60)
    - Export `PostureState` interface: score, category, angles, timestamp
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_
  
  - [ ] 2.3 Create AlertManager service
    - Create `src/services/AlertManager.ts`
    - Implement state tracking for "Bad" posture duration
    - Implement 8-second threshold detection
    - Implement alert triggering when threshold reached
    - Implement alert clearing with 2-second grace period on improvement
    - Export `update(category, timestamp)` method returning alert status
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 3. Build React components
  - [ ] 3.1 Create VideoCanvas component
    - Create `src/components/VideoCanvas.tsx`
    - Render video element (640x480, mirrored) with ref for service access
    - Overlay canvas for pose skeleton drawing
    - Implement skeleton rendering: connections (shoulders-spine-hips), landmarks (circles)
    - Color-code skeleton based on posture category (green/yellow/red)
    - Show "Reposition" message when no pose detected for >3 seconds
    - Accept props: `landmarks`, `postureCategory`, `isActive`
    - _Requirements: 1.1, 1.3, 5.2, 5.3, 5.4_
  
  - [ ] 3.2 Create ScoreDisplay component
    - Create `src/components/ScoreDisplay.tsx`
    - Display large posture score (0-100) with color coding
    - Display category badge ("Good" 🟢 / "Warning" 🟡 / "Bad" 🔴)
    - Apply Tailwind colors: green (#10B981), yellow (#F59E0B), red (#EF4444)
    - Handle null state (before first detection)
    - Accept props: `score`, `category`
    - _Requirements: 5.1, 5.3_
  
  - [ ] 3.3 Create ControlPanel component
    - Create `src/components/ControlPanel.tsx`
    - Render Start button (enabled when stopped)
    - Render Stop button (enabled when active)
    - Display privacy notice: "🔒 All processing is local. No data leaves your device."
    - Accept props: `isActive`, `onStart`, `onStop`
    - _Requirements: 6.1, 6.2, 7.3_
  
  - [ ] 3.4 Create Alert component
    - Create `src/components/Alert.tsx`
    - Render modal with semi-transparent overlay
    - Display warning icon and correction tip: "Straighten your back and level your head"
    - Include Dismiss button
    - Only render when `visible` prop is true
    - Accept props: `visible`, `onDismiss`
    - _Requirements: 4.2, 4.3_

- [ ] 4. Integrate App component orchestration
  - [ ] 4.1 Wire up App state management
    - Update `src/App.tsx` with state: `isActive`, `cameraError`, `currentPosture`, `alertVisible`, `landmarks`
    - Initialize service instances: `PoseDetectionService`, `PostureScorer`, `AlertManager`
    - Implement `handleStart()`: initialize camera, start detection loop
    - Implement `handleStop()`: stop detection, release camera, reset state
    - Implement detection loop with `requestAnimationFrame` (target 15-30 fps)
    - _Requirements: 1.1, 1.2, 1.5, 6.1, 6.2_
  
  - [ ] 4.2 Connect services to state updates
    - In detection loop: get landmarks from `PoseDetectionService`
    - Pass landmarks to `PostureScorer` → update `currentPosture` state
    - Pass posture category to `AlertManager` → update `alertVisible` state
    - Handle "no pose detected" case: show reposition message, freeze score
    - Update state every 1-2 seconds for score (not every frame) to reduce jitter
    - _Requirements: 1.3, 2.1, 2.2, 2.3, 4.1, 4.2, 5.4_
  
  - [ ] 4.3 Render component tree with props
    - Render `VideoCanvas` with landmarks and posture category
    - Render `ScoreDisplay` with current score and category
    - Render `ControlPanel` with isActive state and handlers
    - Render `Alert` with visibility and dismiss handler
    - Handle camera errors: display error message in UI
    - _Requirements: All UI requirements 5.1-5.4, 1.4_

- [ ] 5. Checkpoint - Manual smoke testing
  - Run dev server: `npm run dev`
  - Test camera access: verify video starts, pose overlay appears
  - Test posture scoring: sit upright (score 80+), lean forward (score <60)
  - Test alert timing: maintain bad posture for 8 seconds, verify alert appears
  - Test alert clearing: improve posture, verify alert dismisses within 5 seconds
  - Test stop button: verify camera releases (indicator off), overlay clears
  - _Ensures all core features work end-to-end_

- [ ] 6. Production build and deployment setup
  - [ ] 6.1 Configure Vite for production
    - Update `vite.config.ts`: set base path, disable sourcemaps
    - Add manual chunk for MediaPipe to `rollupOptions`
    - Verify model file (`.task`) is included in build output
    - _Requirements: Deployment foundation_
  
  - [ ] 6.2 Create production build
    - Run `npm run build`
    - Verify `dist/` output includes all assets
    - Test production build locally: `npm run preview`
    - Verify camera access works in preview (HTTPS required)
    - _Requirements: 7.1 (client-side only)_
  
  - [ ] 6.3 Deploy to static hosting
    - Choose platform: Netlify or Vercel
    - Configure deployment: point to `dist/` folder, set build command
    - Deploy and verify HTTPS access
    - Test full application on deployed URL
    - Verify no network requests except initial load (check DevTools Network tab)
    - _Requirements: 7.1, 7.2 (privacy guarantees)_

- [ ] 7. Final checkpoint - End-to-end validation
  - Verify all requirements met against requirements.md
  - Test on deployed URL: camera start, score updates, alert timing, stop button
  - Verify privacy: no network traffic during operation (DevTools Network tab)
  - Document any known issues or browser-specific behaviors
  - _Final MVP validation_

## Notes

- **No property-based tests:** Correctness properties in design.md are documentation only
- **No unit tests:** Manual smoke tests are sufficient for hackathon MVP
- **Manual testing:** Focus on two smoke tests (camera start, score updates) at checkpoints
- **Browser target:** Modern Chrome/Edge only for MVP - no cross-browser testing required
- **No settings persistence:** All state in-memory, cleared on page refresh
- **No accessibility features:** Deferred to post-MVP (screen readers, keyboard nav, high contrast)
- **Deployment requires HTTPS:** getUserMedia API requires secure context

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 3, "tasks": ["3.1", "3.2", "3.3", "3.4"] },
    { "id": 4, "tasks": ["4.1"] },
    { "id": 5, "tasks": ["4.2"] },
    { "id": 6, "tasks": ["4.3"] },
    { "id": 7, "tasks": ["6.1"] },
    { "id": 8, "tasks": ["6.2"] },
    { "id": 9, "tasks": ["6.3"] }
  ]
}
```
