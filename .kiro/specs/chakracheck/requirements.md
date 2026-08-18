# Requirements Document: ChakraCheck (MVP Scope)

## Introduction

ChakraCheck is a browser-based posture monitoring web application for programmers. It uses
the user's webcam to detect body pose in real time, scores posture quality based on
forward-head angle and shoulder symmetry, and provides visual alerts when poor posture is
detected for a sustained period. All processing happens client-side in the browser — no
server communication, no user accounts, no persistent data storage.

This is a deliberately scoped MVP for a solo hackathon build. Settings, accessibility,
performance guarantees, and multi-browser certification are explicitly deferred (see
"Future Improvements" at the end) so the core experience can be built solidly and demoed live.

## Glossary

- **Posture Score**: A numeric value (0–100) representing the quality of the user's current posture
- **Forward-Head Angle**: The angle of the head relative to vertical spine alignment
- **Shoulder Symmetry**: How level the user's shoulders are, left to right
- **Alert Threshold**: Fixed at 8 seconds of sustained "Bad" posture before a warning fires
- **Pose Landmarks**: Key body joint positions detected by the pose estimation model

## Requirements

### Requirement 1: Real-Time Pose Detection

**User Story:** As a user, I want the application to detect my body pose using my webcam,
so that I can monitor my posture in real time.

#### Acceptance Criteria
1. WHEN the user clicks Start, THE Application SHALL request webcam access and begin processing video frames.
2. WHILE active, THE Application SHALL process frames at approximately 15–30 fps.
3. FOR EACH processed frame, THE Application SHALL detect key pose landmarks including nose/ears, shoulders, and hips.
4. IF webcam access is denied or unavailable, THEN THE Application SHALL display a clear error message with a retry option.
5. WHEN the user clicks Stop, THE Application SHALL stop accessing the webcam and release resources.

### Requirement 2: Posture Scoring

**User Story:** As a user, I want my posture scored based on my body alignment, so I know
how good or bad it currently is.

#### Acceptance Criteria
1. THE Application SHALL calculate a Posture Score (0–100) from the Forward-Head Angle and Shoulder Symmetry.
2. Smaller Forward-Head Angle and more level shoulders SHALL result in a higher score; larger angle and more asymmetry SHALL result in a lower score.
3. THE Posture Score SHALL update at least every 1–2 seconds (not every single frame) to avoid jitter from noisy landmark data.

### Requirement 3: Posture Categories

**User Story:** As a user, I want my posture categorized as Good, Warning, or Bad, so I can
quickly understand its severity.

#### Acceptance Criteria
1. WHEN Posture Score = 80, THE Application SHALL classify posture as "Good."
2. WHEN Posture Score is 60–79, THE Application SHALL classify posture as "Warning."
3. WHEN Posture Score < 60, THE Application SHALL classify posture as "Bad."

### Requirement 4: Alert System

**User Story:** As a user, I want a visual alert when my bad posture persists for more than
8 seconds, so I'm reminded to correct it without being spammed for brief movements.

#### Acceptance Criteria
1. THE Application SHALL track how long posture remains continuously in "Bad" category.
2. IF "Bad" posture persists for = 8 seconds, THEN THE Application SHALL display an on-screen alert with a short correction tip.
3. WHEN posture returns to "Good" or "Warning," THE Application SHALL clear the alert within a few seconds.

### Requirement 5: Visual Feedback Display

**User Story:** As a user, I want to see my posture score, category, and pose overlay
clearly on screen, so I can monitor posture without interrupting my work.

#### Acceptance Criteria
1. THE Application SHALL display the current Posture Score and Category, color-coded (green/yellow/red).
2. THE Application SHALL draw a skeleton overlay on the live video showing key landmarks and connecting lines.
3. THE overlay color SHALL match the current posture category (green = Good, yellow = Warning, red = Bad).
4. IF the user moves out of camera view, THE Application SHALL show a "Reposition" message.

### Requirement 6: Basic Controls

**User Story:** As a user, I want to start and stop posture monitoring, so I control when
I'm being tracked.

#### Acceptance Criteria
1. THE Application SHALL provide a Start button to begin pose detection.
2. THE Application SHALL provide a Stop button to end pose detection and release the camera.

### Requirement 7: Privacy

**User Story:** As a user, I want confidence that my video is private and never leaves my
device, so I can use the app without privacy concerns.

#### Acceptance Criteria
1. NO video frames or pose data SHALL be transmitted to any server — all processing is client-side only.
2. NO pose or video data SHALL be stored persistently beyond the current browser session.
3. THE Application SHALL display a short privacy notice stating no data is transmitted or stored.

## Future Improvements (explicitly out of scope for MVP)
- Configurable settings (alert threshold, alert intensity, toggle overlay) with localStorage persistence
- Full accessibility support (screen reader labels, full keyboard navigation, 200% zoom support)
- Formal cross-browser version certification (Chrome/Firefox/Edge/Safari)
- CPU/GPU usage optimization and thermal throttling safeguards
- Session history / stats tracking across sessions
