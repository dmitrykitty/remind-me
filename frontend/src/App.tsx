import { useCallback, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";

import CameraView from "./components/CameraView";
import BottomControls from "./components/BottomControls";
import TopControls from "./components/TopControls";
import FaceOverlay from "./components/FaceOverlay";
import UnknownFaceOverlay from "./components/UnknownFaceOverlay";
import QuickEnrollModal from "./components/QuickEnrollModal";
import ObjectOverlay from "./components/ObjectOverlay";
import VoiceCommandToast from "./components/VoiceCommandToast";
import HelpRoom from "./components/HelpRoom";
import SettingsPanel from "./components/SettingsPanel";
import MemoryPanel from "./components/MemoryPanel";
import EnrollPersonModal from "./components/EnrollPersonModal";
import EnrollObjectModal from "./components/EnrollObjectModal";
import type { UnknownFace } from "./api/types";

import { useCamera } from "./hooks/useCamera";
import { useRecognition } from "./hooks/useRecognition";
import { useVoiceCommand } from "./hooks/useVoiceCommand";

type EnrollType = "person" | "object" | null;

export default function App() {
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [enrollType, setEnrollType] = useState<EnrollType>(null);
  const [quickEnrollFace, setQuickEnrollFace] = useState<UnknownFace | null>(null);
  const [memoryVersion, setMemoryVersion] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);

  const bumpMemory = useCallback(() => setMemoryVersion((v) => v + 1), []);

  const videoRef = useRef<HTMLVideoElement>(null);

  useCamera(videoRef, cameraEnabled);
  const { faces, unknownFaces, objects, frameSize, connected } = useRecognition(
    videoRef,
    cameraEnabled,
  );
  const {
    isRecording,
    isProcessing,
    lastResult,
    startRecording,
    stopRecording,
    clearResult,
  } = useVoiceCommand(videoRef);

  const handleToggleMic = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Bump memory when voice command adds a person/object
  const handleDismissVoice = useCallback(() => {
    if (lastResult?.success && (lastResult.intent === "add_person" || lastResult.intent === "add_object")) {
      bumpMemory();
    }
    clearResult();
  }, [lastResult, bumpMemory, clearResult]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none">
      {/* Camera feed */}
      <CameraView videoRef={videoRef} enabled={cameraEnabled} />

      {/* Known face overlays */}
      {faces.map((face) => (
        <FaceOverlay
          key={face.person_id}
          face={face}
          frameSize={frameSize}
        />
      ))}

      {/* Unknown face overlays — tappable to enroll */}
      <AnimatePresence>
        {unknownFaces.map((uf) => (
          <UnknownFaceOverlay
            key={uf.face_id}
            face={uf}
            frameSize={frameSize}
            onTap={(f) => setQuickEnrollFace(f)}
          />
        ))}
      </AnimatePresence>

      {/* Object overlays */}
      <AnimatePresence>
        {objects.length > 0 && <ObjectOverlay objects={objects} />}
      </AnimatePresence>

      {/* Connection indicator */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30">
        <div
          className={`w-2 h-2 rounded-full ${connected ? "bg-mint-400" : "bg-red-400"}`}
          title={connected ? "Connected" : "Disconnected"}
        />
      </div>

      {/* Controls */}
      <TopControls
        onSettings={() => setSettingsOpen(true)}
        onMemory={() => setMemoryOpen(true)}
        onAddPerson={() => setEnrollType("person")}
        onAddObject={() => setEnrollType("object")}
      />
      <BottomControls
        micEnabled={isRecording}
        cameraEnabled={cameraEnabled}
        onToggleMic={handleToggleMic}
        onToggleCamera={() => setCameraEnabled((v) => !v)}
        isProcessing={isProcessing}
      />

      {/* SOS / Help button */}
      <button
        onClick={() => setHelpOpen(true)}
        className="absolute bottom-28 right-6 z-30 w-16 h-16 rounded-full bg-red-500/90 text-white text-2xl font-bold flex items-center justify-center shadow-lg active:scale-95 transition-transform border-2 border-red-300/40"
        aria-label="Wezwij pomoc AI"
      >
        SOS
      </button>

      {/* Voice command feedback */}
      <VoiceCommandToast
        isRecording={isRecording}
        isProcessing={isProcessing}
        result={lastResult}
        onDismiss={handleDismissVoice}
      />

      {/* Panels & modals */}
      <AnimatePresence>
        {settingsOpen && (
          <SettingsPanel onClose={() => setSettingsOpen(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {memoryOpen && (
          <MemoryPanel
            onClose={() => setMemoryOpen(false)}
            refreshKey={memoryVersion}
            onEnrollPerson={() => {
              setMemoryOpen(false);
              setEnrollType("person");
            }}
            onEnrollObject={() => {
              setMemoryOpen(false);
              setEnrollType("object");
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {enrollType === "person" && (
          <EnrollPersonModal
            videoRef={videoRef}
            onClose={() => {
              setEnrollType(null);
              bumpMemory();
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {enrollType === "object" && (
          <EnrollObjectModal
            videoRef={videoRef}
            onClose={() => {
              setEnrollType(null);
              bumpMemory();
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {quickEnrollFace && (
          <QuickEnrollModal
            face={quickEnrollFace}
            onClose={() => setQuickEnrollFace(null)}
            onSaved={() => {
              setQuickEnrollFace(null);
              bumpMemory();
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {helpOpen && <HelpRoom onClose={() => setHelpOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}
