/**
 * Persistent Archive Storage — Last Local
 * Saves discovered endings (out of 8), 13-Case Psych Log unlocks, completed lines (G/L/7),
 * intercepted tuner channels, achievements, and recent ride history in localStorage.
 * Pure serialization/merge helpers allow full deterministic unit testing without a DOM.
 */

import { CanonicalEndingId, ENDING_CATALOG } from './endings';
import { ChapterId, SubwayLineId } from './route';

export interface ArchiveRunRecord {
  id: string;
  timestampIso: string;
  lineId: SubwayLineId;
  chapterId: ChapterId;
  difficulty: 'standard' | 'practice' | 'nightmare';
  endingId: string;
  endingTitle: string;
  finalSuspicion: number;
  finalSanity: number;
  trueFlags: number;
  falsePositives: number;
  durationSec: number;
}

export interface ArchiveData {
  version: 2;
  discoveredEndings: CanonicalEndingId[];
  observedCases: number[]; // 1..13
  completedLines: SubwayLineId[];
  bestSuspicionByLine: Partial<Record<SubwayLineId, number>>;
  unlockedTunerChannels: string[];
  achievements: string[];
  nightmareUnlocked: boolean;
  totalRidesCompleted: number;
  runHistory: ArchiveRunRecord[];
}

export const ARCHIVE_STORAGE_KEY = 'last_local_archive_v2';
const LEGACY_NIGHTMARE_KEY = 'last_local_nightmare_unlocked_v1';
const LEGACY_ACHIEVEMENTS_KEY = 'last_local_achievements_v1';

export function createEmptyArchive(): ArchiveData {
  return {
    version: 2,
    discoveredEndings: [],
    observedCases: [],
    completedLines: [],
    bestSuspicionByLine: {},
    unlockedTunerChannels: [],
    achievements: [],
    nightmareUnlocked: false,
    totalRidesCompleted: 0,
    runHistory: [],
  };
}

export function serializeArchive(archive: ArchiveData): string {
  return JSON.stringify(archive);
}

export function deserializeArchive(raw: string | null | undefined): ArchiveData {
  if (!raw) return createEmptyArchive();
  try {
    const parsed = JSON.parse(raw) as Partial<ArchiveData>;
    const validEndingIds = new Set<string>(ENDING_CATALOG.map((e) => e.id));
    const discoveredEndings = Array.isArray(parsed.discoveredEndings)
      ? Array.from(
          new Set(
            parsed.discoveredEndings.filter((id): id is CanonicalEndingId =>
              validEndingIds.has(String(id)),
            ),
          ),
        )
      : [];
    const observedCases = Array.isArray(parsed.observedCases)
      ? Array.from(
          new Set(
            parsed.observedCases
              .map((n) => Number(n))
              .filter((n) => Number.isInteger(n) && n >= 1 && n <= 13),
          ),
        ).sort((a, b) => a - b)
      : [];
    const validLines = new Set<string>(['G', 'L', '7']);
    const completedLines = Array.isArray(parsed.completedLines)
      ? Array.from(
          new Set(
            parsed.completedLines.filter((l): l is SubwayLineId => validLines.has(String(l))),
          ),
        )
      : [];
    return {
      version: 2,
      discoveredEndings,
      observedCases,
      completedLines,
      bestSuspicionByLine:
        parsed.bestSuspicionByLine && typeof parsed.bestSuspicionByLine === 'object'
          ? { ...parsed.bestSuspicionByLine }
          : {},
      unlockedTunerChannels: Array.isArray(parsed.unlockedTunerChannels)
        ? Array.from(new Set(parsed.unlockedTunerChannels.map(String)))
        : [],
      achievements: Array.isArray(parsed.achievements)
        ? Array.from(new Set(parsed.achievements.map(String)))
        : [],
      nightmareUnlocked: Boolean(parsed.nightmareUnlocked),
      totalRidesCompleted: Math.max(0, Number(parsed.totalRidesCompleted) || 0),
      runHistory: Array.isArray(parsed.runHistory) ? parsed.runHistory.slice(0, 12) : [],
    };
  } catch {
    return createEmptyArchive();
  }
}

export function recordRunInArchive(
  archive: ArchiveData,
  params: {
    lineId: SubwayLineId;
    chapterId: ChapterId;
    difficulty: 'standard' | 'practice' | 'nightmare';
    endingId: string;
    endingTitle: string;
    finalSuspicion: number;
    finalSanity: number;
    trueFlags: number;
    falsePositives: number;
    durationSec: number;
    highestStopReached: number;
    tunerChannelIds: readonly string[];
    achievements: readonly string[];
    nowIso?: string;
  },
): ArchiveData {
  const validEndingIds = new Set<string>(ENDING_CATALOG.map((e) => e.id));
  const discoveredEndings = [...archive.discoveredEndings];
  if (
    validEndingIds.has(params.endingId) &&
    !discoveredEndings.includes(params.endingId as CanonicalEndingId)
  ) {
    discoveredEndings.push(params.endingId as CanonicalEndingId);
  }

  const caseSet = new Set<number>(archive.observedCases);
  const cappedStop = Math.max(0, Math.min(13, params.highestStopReached));
  for (let s = 1; s <= cappedStop; s++) {
    caseSet.add(s);
  }
  const observedCases = Array.from(caseSet).sort((a, b) => a - b);

  const completedLines = [...archive.completedLines];
  const isFullLineClear =
    params.difficulty !== 'practice' &&
    params.chapterId === 'full' &&
    params.endingId !== 'trial_collapsed';
  if (isFullLineClear && !completedLines.includes(params.lineId)) {
    completedLines.push(params.lineId);
  }

  const bestSuspicionByLine = { ...archive.bestSuspicionByLine };
  if (isFullLineClear) {
    const prevBest = bestSuspicionByLine[params.lineId];
    if (prevBest === undefined || params.finalSuspicion < prevBest) {
      bestSuspicionByLine[params.lineId] = params.finalSuspicion;
    }
  }

  const unlockedTunerChannels = Array.from(
    new Set([...archive.unlockedTunerChannels, ...params.tunerChannelIds]),
  );
  const achievements = Array.from(new Set([...archive.achievements, ...params.achievements]));
  const nightmareUnlocked =
    archive.nightmareUnlocked || (params.difficulty !== 'practice' && params.endingId !== 'trial_collapsed');

  const runRecord: ArchiveRunRecord = {
    id: `run-${archive.totalRidesCompleted + 1}-${params.durationSec}`,
    timestampIso: params.nowIso ?? new Date().toISOString(),
    lineId: params.lineId,
    chapterId: params.chapterId,
    difficulty: params.difficulty,
    endingId: params.endingId,
    endingTitle: params.endingTitle,
    finalSuspicion: params.finalSuspicion,
    finalSanity: params.finalSanity,
    trueFlags: params.trueFlags,
    falsePositives: params.falsePositives,
    durationSec: params.durationSec,
  };

  return {
    version: 2,
    discoveredEndings,
    observedCases,
    completedLines,
    bestSuspicionByLine,
    unlockedTunerChannels,
    achievements,
    nightmareUnlocked,
    totalRidesCompleted: archive.totalRidesCompleted + 1,
    runHistory: [runRecord, ...archive.runHistory].slice(0, 12),
  };
}

export function loadArchive(): ArchiveData {
  try {
    if (typeof window === 'undefined') return createEmptyArchive();
    const raw = window.localStorage.getItem(ARCHIVE_STORAGE_KEY);
    const data = deserializeArchive(raw);
    // Migrate legacy keys seamlessly if present
    if (!data.nightmareUnlocked && window.localStorage.getItem(LEGACY_NIGHTMARE_KEY) === '1') {
      data.nightmareUnlocked = true;
    }
    const legacyAch = window.localStorage.getItem(LEGACY_ACHIEVEMENTS_KEY);
    if (legacyAch) {
      try {
        const parsed = JSON.parse(legacyAch) as string[];
        if (Array.isArray(parsed)) {
          data.achievements = Array.from(new Set([...data.achievements, ...parsed]));
        }
      } catch {
        // Ignore malformed legacy achievements
      }
    }
    return data;
  } catch {
    return createEmptyArchive();
  }
}

export function saveArchive(archive: ArchiveData): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ARCHIVE_STORAGE_KEY, serializeArchive(archive));
    if (archive.nightmareUnlocked) {
      window.localStorage.setItem(LEGACY_NIGHTMARE_KEY, '1');
    }
    window.localStorage.setItem(LEGACY_ACHIEVEMENTS_KEY, JSON.stringify(archive.achievements));
  } catch {
    // Ignore storage failures
  }
}

export function clearArchive(): ArchiveData {
  const empty = createEmptyArchive();
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(ARCHIVE_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_NIGHTMARE_KEY);
      window.localStorage.removeItem(LEGACY_ACHIEVEMENTS_KEY);
    }
  } catch {
    // Ignore
  }
  return empty;
}
