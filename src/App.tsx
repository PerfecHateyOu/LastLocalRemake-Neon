/**
 * Last Local — Main Application Shell
 * Orchestrates the 3D SubwayScene, pure GameState machine (G/L/7 lines, 4 Chapters,
 * 3-Stage False Stop Trial, Radio/PA Frequency Tuner, 13-Case Psych Log, Persistent Archive,
 * and 8 Priority-Ranked Endings), InputController, Web Audio synthesis, and NYC Transit HUD.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArchiveModal } from './components/ArchiveModal';
import { EndingReport } from './components/EndingReport';
import { EvidenceLogModal } from './components/EvidenceLogModal';
import { FalseStopTrialModal } from './components/FalseStopTrialModal';
import { HudOverlay } from './components/HudOverlay';
import { MobileControls } from './components/MobileControls';
import { PaBoardModal } from './components/PaBoardModal';
import { PauseModal } from './components/PauseModal';
import { PolaroidViewfinder } from './components/PolaroidViewfinder';
import { RadioTunerWidget } from './components/RadioTunerWidget';
import { TapeRecorderWidget } from './components/TapeRecorderWidget';
import { TitleScreen } from './components/TitleScreen';
import { TutorialOverlay } from './components/TutorialOverlay';
import { AnomalyTargetId } from './game/anomalies';
import { ArchiveData, clearArchive, loadArchive } from './game/archive';
import { SubwayAudioEngine } from './game/audio';
import {
  addMouseLookDelta,
  addTouchLookDelta,
  clearHeldInputs,
  createInitialInputState,
  handleKeyDown,
  handleKeyUp,
  InputState,
  setInputPaused,
  setMobileMoveStick,
  stepInput,
} from './game/input';
import { ChapterId, SubwayLineId } from './game/route';
import {
  ActivePanelId,
  addPolaroidPhoto,
  adjustTunerFrequency,
  answerMaskPrompt,
  answerTrialChoice,
  attemptStepOffAtStop,
  chooseSafeHaven,
  createInitialGameState,
  EvpRecording,
  finishEvpRecording,
  GameSettings,
  GameState,
  getCurrentHeartbeat,
  getCurrentLedText,
  getCurrentStop,
  lockTunerSignal,
  RideDifficulty,
  setTrialHoldState,
  stepGameState,
  submitPlayerFlag,
} from './game/state';
import { evaluateTunerSignal } from './game/tuner';
import { SubwayScene, SubwaySceneHandle } from './three/SubwayScene';

function checkAutostartParam(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('autostart') === '1';
  } catch {
    return false;
  }
}

export default function App() {
  const autostart = checkAutostartParam();

  const initialGame = createInitialGameState('standard', autostart ? 'playing' : 'title', 'G', 'full');
  const gameStateRef = useRef<GameState>(initialGame);
  const inputStateRef = useRef<InputState>(createInitialInputState(1.0));
  const audioRef = useRef<SubwayAudioEngine | null>(null);
  const sceneRef = useRef<SubwaySceneHandle | null>(null);
  const hudSyncAccRef = useRef(0);

  const [hudState, setHudState] = useState<GameState>(initialGame);
  const [selectedLine, setSelectedLine] = useState<SubwayLineId>('G');
  const [selectedChapter, setSelectedChapter] = useState<ChapterId>('full');
  const [archive, setArchive] = useState<ArchiveData>(() => loadArchive());
  const [archiveOpen, setArchiveOpen] = useState(false);

  const [settings, setSettings] = useState<GameSettings>({
    volume: 0.72,
    muted: false,
    sensitivity: 1.0,
    reducedGlitch: false,
  });
  const [settingsOpenOnTitle, setSettingsOpenOnTitle] = useState(false);
  const [aimTarget, setAimTarget] = useState<AnomalyTargetId | null>(null);
  const [pointerLocked, setPointerLocked] = useState(false);
  const aimTargetRef = useRef<AnomalyTargetId | null>(null);

  // Lazy-create Web Audio engine once
  if (!audioRef.current) {
    audioRef.current = new SubwayAudioEngine();
  }

  const syncHudNow = useCallback((next: GameState) => {
    gameStateRef.current = next;
    setHudState(next);
    if (next.screen === 'ending') {
      setArchive(loadArchive());
    }
  }, []);

  // Mirror state machine to document.body.dataset for reliable state inspection
  useEffect(() => {
    const mapped =
      hudState.screen === 'ending'
        ? 'gameover'
        : hudState.screen === 'tutorial'
          ? 'title'
          : hudState.screen;
    document.body.dataset.state = mapped;
    document.body.dataset.line = hudState.lineId;
    document.body.dataset.stop = String(hudState.stopIndex + 1);
    document.body.dataset.phase = hudState.phase;
    document.body.dataset.suspicion = String(hudState.suspicion.value);
    document.body.dataset.sanity = String(hudState.sanity.value);
  }, [
    hudState.screen,
    hudState.lineId,
    hudState.stopIndex,
    hudState.phase,
    hudState.suspicion.value,
    hudState.sanity.value,
  ]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.dispose();
    };
  }, []);

  const updateSettings = useCallback((partial: Partial<GameSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      inputStateRef.current.sensitivity = next.sensitivity;
      audioRef.current?.setVolume(next.volume);
      audioRef.current?.setMuted(next.muted);
      return next;
    });
  }, []);

  const handleSelectLine = useCallback(
    (lineId: SubwayLineId) => {
      setSelectedLine(lineId);
      if (gameStateRef.current.screen === 'title') {
        const latestChapter = gameStateRef.current.chapterId;
        syncHudNow(createInitialGameState('standard', 'title', lineId, latestChapter));
      }
    },
    [syncHudNow],
  );

  const handleSelectChapter = useCallback(
    (chapterId: ChapterId) => {
      setSelectedChapter(chapterId);
      if (gameStateRef.current.screen === 'title') {
        const latestLine = gameStateRef.current.lineId;
        syncHudNow(createInitialGameState('standard', 'title', latestLine, chapterId));
      }
    },
    [syncHudNow],
  );

  const beginRide = useCallback(
    (
      difficulty: RideDifficulty,
      skipTutorial = false,
      lineOverride?: SubwayLineId,
      chapterOverride?: ChapterId,
    ) => {
      const lineId = lineOverride ?? selectedLine;
      const chapterId = difficulty === 'practice' ? 'full' : (chapterOverride ?? selectedChapter);
      audioRef.current?.unlock();
      audioRef.current?.setPaused(false);
      setSettingsOpenOnTitle(false);
      setArchiveOpen(false);
      inputStateRef.current = createInitialInputState(settings.sensitivity);
      const nextScreen = skipTutorial ? 'playing' : 'tutorial';
      const fresh = createInitialGameState(difficulty, nextScreen, lineId, chapterId);
      syncHudNow(fresh);
    },
    [selectedLine, selectedChapter, settings.sensitivity, syncHudNow],
  );

  const finishTutorialAndPlay = useCallback(() => {
    audioRef.current?.unlock();
    audioRef.current?.setPaused(false);
    clearHeldInputs(inputStateRef.current);
    setInputPaused(inputStateRef.current, false);
    const next: GameState = { ...gameStateRef.current, screen: 'playing' };
    syncHudNow(next);
  }, [syncHudNow]);

  const setPaused = useCallback(
    (paused: boolean) => {
      const gs = gameStateRef.current;
      if (paused && gs.screen !== 'playing') return;
      if (!paused && gs.screen !== 'paused') return;

      setInputPaused(inputStateRef.current, paused);
      audioRef.current?.setPaused(paused);
      if (paused) {
        sceneRef.current?.exitPointerLock();
      }
      const next: GameState = {
        ...gs,
        screen: paused ? 'paused' : 'playing',
      };
      syncHudNow(next);
    },
    [syncHudNow],
  );

  const togglePanel = useCallback(
    (panel: Exclude<ActivePanelId, 'none'>) => {
      const gs = gameStateRef.current;
      if (gs.screen !== 'playing' || gs.phase === 'trial') return;
      const nextPanel = gs.activePanel === panel ? 'none' : panel;
      if (nextPanel !== 'none') {
        sceneRef.current?.exitPointerLock();
        clearHeldInputs(inputStateRef.current);
      }
      syncHudNow({ ...gs, activePanel: nextPanel });
    },
    [syncHudNow],
  );

  const handleFlagTarget = useCallback(
    (targetId: AnomalyTargetId) => {
      const gs = gameStateRef.current;
      if (gs.screen !== 'playing' || gs.activePanel !== 'none' || gs.phase === 'trial') return;
      const next = submitPlayerFlag(gs, targetId);
      syncHudNow(next);
    },
    [syncHudNow],
  );

  const handleCapturePolaroid = useCallback(() => {
    const gs = gameStateRef.current;
    if (gs.screen !== 'playing') return;
    audioRef.current?.unlock();
    audioRef.current?.playPolaroidShutter();
    const dataUrl = sceneRef.current?.capturePolaroidDataUrl();
    if (dataUrl) {
      syncHudNow(addPolaroidPhoto(gs, dataUrl));
    }
  }, [syncHudNow]);

  const handleToggleEvpRecord = useCallback(() => {
    const gs = gameStateRef.current;
    if (gs.screen !== 'playing') return;
    audioRef.current?.unlock();
    audioRef.current?.playTapeClick();
    if (gs.evpRecordingActive) {
      syncHudNow(finishEvpRecording(gs));
    } else {
      syncHudNow({
        ...gs,
        evpRecordingActive: true,
        evpRecordElapsed: 0,
      });
    }
  }, [syncHudNow]);

  const handlePlayEvpClip = useCallback((clip: EvpRecording) => {
    audioRef.current?.unlock();
    audioRef.current?.playEvpClip(clip.hasAnomalyResonance);
  }, []);

  const handleTunerFrequencyChange = useCallback(
    (nextFreq: number) => {
      const gs = gameStateRef.current;
      const next = adjustTunerFrequency(gs, nextFreq);
      const stop = getCurrentStop(next);
      const { strength } = evaluateTunerSignal(next.tunerFrequencyMhz, next.lineId, stop.number);
      audioRef.current?.unlock();
      audioRef.current?.playTunerPulse(strength);
      syncHudNow(next);
    },
    [syncHudNow],
  );

  const handleLockTunerSignal = useCallback(() => {
    const gs = gameStateRef.current;
    audioRef.current?.unlock();
    audioRef.current?.playTapeClick();
    syncHudNow(lockTunerSignal(gs));
  }, [syncHudNow]);

  const handleAnswerMask = useCallback(
    (optionId: string) => {
      const next = answerMaskPrompt(gameStateRef.current, optionId);
      syncHudNow(next);
    },
    [syncHudNow],
  );

  const handleSafeHavenChoice = useCallback(
    (takeShelter: boolean) => {
      const next = chooseSafeHaven(gameStateRef.current, takeShelter);
      syncHudNow(next);
    },
    [syncHudNow],
  );

  const handleAttemptStepOff = useCallback(() => {
    const next = attemptStepOffAtStop(gameStateRef.current);
    if (next.phase === 'trial') {
      sceneRef.current?.exitPointerLock();
      clearHeldInputs(inputStateRef.current);
    }
    syncHudNow(next);
  }, [syncHudNow]);

  const handleTrialChoice = useCallback(
    (choiceId: string) => {
      const next = answerTrialChoice(gameStateRef.current, choiceId);
      syncHudNow(next);
    },
    [syncHudNow],
  );

  const handleTrialHold = useCallback(
    (holding: boolean) => {
      const gs = gameStateRef.current;
      if (gs.phase !== 'trial' || !gs.activeTrial || gs.activeTrial.stage !== 2) return;
      if (gs.activeTrial.holdingStill !== holding) {
        syncHudNow(setTrialHoldState(gs, holding));
      }
    },
    [syncHudNow],
  );

  const handleRestraintHold = useCallback(
    (holding: boolean) => {
      const gs = gameStateRef.current;
      if (gs.phase !== 'restraint') return;
      if (gs.restraintHolding !== holding) {
        syncHudNow({ ...gs, restraintHolding: holding });
      }
    },
    [syncHudNow],
  );

  // Global keyboard, mouse-look, and focus-loss hygiene listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const gs = gameStateRef.current;

      // Title screen: Enter or Space triggers primary start handshake (when no modal open)
      if (gs.screen === 'title' && !settingsOpenOnTitle && !archiveOpen) {
        if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat) {
          e.preventDefault();
          beginRide('standard', false);
        }
        return;
      }

      if (gs.screen === 'tutorial') {
        if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat) {
          e.preventDefault();
          finishTutorialAndPlay();
        }
        return;
      }

      // Strict Pause toggle (ignore repeats, clear held keys, resume only on fresh key press)
      const { pauseToggle } = handleKeyDown(inputStateRef.current, e.code, e.repeat);
      if (pauseToggle) {
        e.preventDefault();
        if (gs.screen === 'playing') {
          if (e.code === 'Escape' && gs.activePanel !== 'none') {
            syncHudNow({ ...gs, activePanel: 'none' });
          } else {
            setPaused(true);
          }
        } else if (gs.screen === 'paused') {
          setPaused(false);
        }
        return;
      }

      if (gs.screen !== 'playing' || e.repeat) return;

      // Active False Stop Trial hotkeys ([1]/[2]/[3] for Stages 1 & 3, [SPACE] for Stage 2)
      if (gs.phase === 'trial' && gs.activeTrial) {
        if (gs.activeTrial.stage === 2 && e.code === 'Space') {
          e.preventDefault();
          handleTrialHold(true);
        } else if (
          gs.activeTrial.stage !== 2 &&
          (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3')
        ) {
          const idx = e.code === 'Digit1' ? 0 : e.code === 'Digit2' ? 1 : 2;
          const choice = gs.activeTrial.choices[idx];
          if (choice) {
            e.preventDefault();
            handleTrialChoice(choice.id);
          }
        }
        return;
      }

      if (e.code === 'KeyB') {
        e.preventDefault();
        togglePanel('pa_board');
      } else if (e.code === 'Tab') {
        e.preventDefault();
        togglePanel('evidence');
      } else if (e.code === 'KeyC') {
        e.preventDefault();
        togglePanel('polaroid');
      } else if (e.code === 'KeyV') {
        e.preventDefault();
        togglePanel('evp');
      } else if (e.code === 'KeyT') {
        e.preventDefault();
        togglePanel('tuner');
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        updateSettings({ muted: !settings.muted });
      } else if (e.code === 'KeyF') {
        if (aimTargetRef.current && gs.activePanel === 'none') {
          e.preventDefault();
          handleFlagTarget(aimTargetRef.current);
        }
      } else if (e.code === 'Space') {
        if (gs.activePanel === 'polaroid') {
          e.preventDefault();
          handleCapturePolaroid();
        } else if (gs.phase === 'restraint') {
          e.preventDefault();
          handleRestraintHold(true);
        }
      } else if (gs.maskPrompt && (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3')) {
        const idx = e.code === 'Digit1' ? 0 : e.code === 'Digit2' ? 1 : 2;
        const opt = gs.maskPrompt.question.options[idx];
        if (opt) {
          e.preventDefault();
          handleAnswerMask(opt.id);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      handleKeyUp(inputStateRef.current, e.code);
      if (e.code === 'Space') {
        if (gameStateRef.current.phase === 'restraint') {
          handleRestraintHold(false);
        } else if (gameStateRef.current.phase === 'trial') {
          handleTrialHold(false);
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (
        document.pointerLockElement &&
        gameStateRef.current.screen === 'playing' &&
        gameStateRef.current.activePanel === 'none' &&
        gameStateRef.current.phase !== 'trial'
      ) {
        addMouseLookDelta(inputStateRef.current, e.movementX, e.movementY);
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const gs = gameStateRef.current;
      if (gs.screen !== 'playing' || gs.activePanel !== 'none' || gs.phase === 'trial') return;
      if (document.pointerLockElement && aimTargetRef.current) {
        handleFlagTarget(aimTargetRef.current);
      }
    };

    const onBlur = () => {
      clearHeldInputs(inputStateRef.current);
    };
    const onVisChange = () => {
      if (document.hidden) {
        clearHeldInputs(inputStateRef.current);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisChange);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, [
    archiveOpen,
    beginRide,
    finishTutorialAndPlay,
    handleAnswerMask,
    handleCapturePolaroid,
    handleFlagTarget,
    handleRestraintHold,
    handleTrialChoice,
    handleTrialHold,
    setPaused,
    settings.muted,
    settingsOpenOnTitle,
    syncHudNow,
    togglePanel,
    updateSettings,
  ]);

  // 60Hz simulation tick driven by SubwayScene (throttled React HUD updates <= 10Hz)
  const handleSimTick = useCallback(
    (dt: number, lookingTarget: AnomalyTargetId | null) => {
      const gs = gameStateRef.current;
      if (gs.screen !== 'playing') {
        return;
      }

      const modalBlockingInput =
        gs.activePanel === 'pa_board' ||
        gs.activePanel === 'evidence' ||
        gs.safeHavenPromptOpen ||
        (gs.phase === 'trial' && gs.activeTrial?.stage !== 2);

      const { movedDuringRestraint } = stepInput(inputStateRef.current, dt, {
        restraintLocked: gs.phase === 'restraint' || (gs.phase === 'trial' && gs.activeTrial?.stage === 2),
        modalOpen: modalBlockingInput,
      });

      const next = stepGameState(gs, dt, {
        lookingAtAnomalyTarget: lookingTarget,
        angularSpeedRadPerSec: inputStateRef.current.angularSpeedRadPerSec,
        restraintMoved: movedDuringRestraint,
        callbacks: {
          onDoorChime: () => audioRef.current?.playDoorChime(),
          onDoorSlide: (opening) => audioRef.current?.playDoorSlide(opening),
          onPaDing: () => audioRef.current?.playPaDing(),
        },
      });

      gameStateRef.current = next;

      // Update continuous Web Audio rumble, clacks, and heartbeat
      const hb = getCurrentHeartbeat(next);
      audioRef.current?.updateContinuous({
        dt,
        trainSpeed: next.trainSpeed,
        isBlackout: next.phase === 'blackout',
        sanityTier: next.sanity.tier,
        heartbeatBpm: hb.bpm,
      });

      // Push React state immediately on discrete changes, otherwise <= 8Hz
      hudSyncAccRef.current += dt;
      const discreteChanged =
        next.screen !== gs.screen ||
        next.phase !== gs.phase ||
        next.stopIndex !== gs.stopIndex ||
        next.suspicion.value !== gs.suspicion.value ||
        next.sanity.value !== gs.sanity.value ||
        next.safeHavenPromptOpen !== gs.safeHavenPromptOpen ||
        (next.maskPrompt === null) !== (gs.maskPrompt === null) ||
        (next.activeTrial?.stage ?? 0) !== (gs.activeTrial?.stage ?? 0) ||
        (next.activeTrial?.strikes ?? 0) !== (gs.activeTrial?.strikes ?? 0) ||
        (next.subtitle?.text ?? '') !== (gs.subtitle?.text ?? '') ||
        next.paFeed.length !== gs.paFeed.length ||
        next.evpClips.length !== gs.evpClips.length ||
        next.tunerLogs.length !== gs.tunerLogs.length ||
        next.neutralNotice !== gs.neutralNotice;

      if (discreteChanged || hudSyncAccRef.current >= 0.14) {
        hudSyncAccRef.current = 0;
        setHudState(next);
        if (next.screen === 'ending') {
          sceneRef.current?.exitPointerLock();
          setArchive(loadArchive());
        }
      }
    },
    [],
  );

  const handleAimTargetChange = useCallback((target: AnomalyTargetId | null) => {
    aimTargetRef.current = target;
    setAimTarget(target);
  }, []);

  const currentStop = getCurrentStop(hudState);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#060708]">
      {/* Isolated Full-Viewport 3D Three.js Canvas */}
      <SubwayScene
        ref={sceneRef}
        gameStateRef={gameStateRef}
        inputStateRef={inputStateRef}
        onSimTick={handleSimTick}
        onAimTargetChange={handleAimTargetChange}
        onPointerLockChange={setPointerLocked}
      />

      {/* START SCREEN */}
      {hudState.screen === 'title' && (
        <TitleScreen
          selectedLine={selectedLine}
          selectedChapter={selectedChapter}
          nightmareUnlocked={archive.nightmareUnlocked}
          archive={archive}
          onSelectLine={handleSelectLine}
          onSelectChapter={handleSelectChapter}
          onStartRide={(diff) => beginRide(diff, false)}
          onOpenArchive={() => {
            setArchive(loadArchive());
            setArchiveOpen(true);
          }}
          onOpenSettings={() => setSettingsOpenOnTitle(true)}
        />
      )}

      {/* SETTINGS MODAL FROM TITLE */}
      {hudState.screen === 'title' && settingsOpenOnTitle && (
        <PauseModal
          mode="settings_only"
          settings={settings}
          stopName={currentStop.name}
          stopNumber={currentStop.number}
          onUpdateSettings={updateSettings}
          onResume={() => setSettingsOpenOnTitle(false)}
          onRestart={() => {}}
          onQuitToTitle={() => setSettingsOpenOnTitle(false)}
        />
      )}

      {/* PERSISTENT ARCHIVE MODAL (from Title or Ending Report) */}
      {archiveOpen && (
        <ArchiveModal
          archive={archive}
          onResetArchive={() => setArchive(clearArchive())}
          onClose={() => setArchiveOpen(false)}
        />
      )}

      {/* SHORT TUTORIAL OVERLAY */}
      {hudState.screen === 'tutorial' && (
        <TutorialOverlay
          difficulty={hudState.difficulty}
          lineId={hudState.lineId}
          chapterId={hudState.chapterId}
          onContinue={finishTutorialAndPlay}
          onBack={() =>
            syncHudNow(createInitialGameState('standard', 'title', selectedLine, selectedChapter))
          }
        />
      )}

      {/* ACTIVE PLAYING HUD + TOOL OVERLAYS */}
      {hudState.screen === 'playing' && (
        <>
          <HudOverlay
            state={hudState}
            settings={settings}
            aimTarget={aimTarget}
            pointerLocked={pointerLocked}
            onTogglePanel={togglePanel}
            onPause={() => setPaused(true)}
            onToggleMute={() => updateSettings({ muted: !settings.muted })}
            onFlagTarget={handleFlagTarget}
            onAnswerMask={handleAnswerMask}
            onSafeHavenChoice={handleSafeHavenChoice}
            onAttemptStepOff={handleAttemptStepOff}
            onRestraintHoldChange={handleRestraintHold}
            onRequestPointerLock={() => {
              audioRef.current?.unlock();
              sceneRef.current?.requestPointerLock();
            }}
          />

          {/* 3-Stage False Stop Trial Overlay */}
          {hudState.phase === 'trial' && hudState.activeTrial && (
            <FalseStopTrialModal
              trial={hudState.activeTrial}
              onSelectChoice={handleTrialChoice}
              onHoldChange={handleTrialHold}
            />
          )}

          {/* Mobile Virtual Stick & Touch Look */}
          {hudState.activePanel === 'none' &&
            !hudState.maskPrompt &&
            !hudState.safeHavenPromptOpen &&
            hudState.phase !== 'restraint' &&
            hudState.phase !== 'trial' && (
              <MobileControls
                onMoveStick={(x, y) => setMobileMoveStick(inputStateRef.current, x, y)}
                onLookDelta={(dx, dy) => addTouchLookDelta(inputStateRef.current, dx, dy)}
                onFlag={() => {
                  if (aimTargetRef.current) {
                    handleFlagTarget(aimTargetRef.current);
                  }
                }}
                canFlag={aimTarget !== null}
              />
            )}

          {/* [B] PA Board Modal */}
          {hudState.activePanel === 'pa_board' && (
            <PaBoardModal
              lineId={hudState.lineId}
              currentStopIndex={hudState.stopIndex}
              suspicionValue={hudState.suspicion.value}
              paFeed={hudState.paFeed}
              ledText={getCurrentLedText(hudState)}
              onClose={() => togglePanel('pa_board')}
            />
          )}

          {/* [TAB] 13-Case Psych Log & Evidence Modal */}
          {hudState.activePanel === 'evidence' && (
            <EvidenceLogModal
              lineId={hudState.lineId}
              highestStopReached={hudState.highestStopReached}
              safeHavenChoice={hudState.safeHavenChoice}
              restraintOutcome={hudState.restraintOutcome}
              falseStopIncidentStops={hudState.falseStopIncidentStops}
              flagLog={hudState.flagLog}
              photos={hudState.photos}
              evpClips={hudState.evpClips}
              tunerLogs={hudState.tunerLogs}
              onPlayEvp={handlePlayEvpClip}
              onClose={() => togglePanel('evidence')}
            />
          )}

          {/* [T] Transit-Band Radio / PA Frequency Tuner */}
          {hudState.activePanel === 'tuner' && (
            <RadioTunerWidget
              frequencyMhz={hudState.tunerFrequencyMhz}
              lineId={hudState.lineId}
              stopNumber={currentStop.number}
              logs={hudState.tunerLogs}
              onChangeFrequency={handleTunerFrequencyChange}
              onLockSignal={handleLockTunerSignal}
              onClose={() => togglePanel('tuner')}
            />
          )}

          {/* [C] Polaroid Viewfinder */}
          {hudState.activePanel === 'polaroid' && (
            <PolaroidViewfinder
              photoCount={hudState.photos.length}
              onCapture={handleCapturePolaroid}
              onClose={() => togglePanel('polaroid')}
            />
          )}

          {/* [V] EVP Tape Recorder */}
          {hudState.activePanel === 'evp' && (
            <TapeRecorderWidget
              recording={hudState.evpRecordingActive}
              elapsedSec={hudState.evpRecordElapsed}
              latestClip={hudState.evpClips[0] ?? null}
              onToggleRecord={handleToggleEvpRecord}
              onPlayLatest={() => {
                if (hudState.evpClips[0]) {
                  handlePlayEvpClip(hudState.evpClips[0]);
                }
              }}
              onClose={() => togglePanel('evp')}
            />
          )}
        </>
      )}

      {/* PAUSED MODAL (fits inside 360x640 phone screen, zero look drift) */}
      {hudState.screen === 'paused' && (
        <PauseModal
          mode="pause"
          settings={settings}
          stopName={currentStop.name}
          stopNumber={currentStop.number}
          onUpdateSettings={updateSettings}
          onResume={() => setPaused(false)}
          onRestart={() => beginRide(hudState.difficulty, true, hudState.lineId, hudState.chapterId)}
          onQuitToTitle={() => {
            setInputPaused(inputStateRef.current, false);
            audioRef.current?.setPaused(true);
            syncHudNow(createInitialGameState('standard', 'title', selectedLine, selectedChapter));
          }}
        />
      )}

      {/* TRAVEL REPORT (8 PRIORITY-RANKED ENDINGS) */}
      {hudState.screen === 'ending' && hudState.endingReport && (
        <EndingReport
          report={hudState.endingReport}
          nightmareUnlocked={archive.nightmareUnlocked}
          discoveredEndingsCount={archive.discoveredEndings.length}
          onOpenArchive={() => {
            setArchive(loadArchive());
            setArchiveOpen(true);
          }}
          onPlayAgain={(diff) => beginRide(diff, true, hudState.lineId, hudState.chapterId)}
          onReturnTitle={() => {
            audioRef.current?.setPaused(true);
            syncHudNow(createInitialGameState('standard', 'title', selectedLine, selectedChapter));
          }}
        />
      )}
    </div>
  );
}
