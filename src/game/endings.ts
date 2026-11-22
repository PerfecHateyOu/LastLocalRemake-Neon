/**
 * Priority-Ranked 8-Ending Evaluator — Last Local
 * Evaluates 8 canonical endings in strict priority order (1 = highest priority)
 * wired directly into ride stats (False Stop Trial outcome, Nightmare mode, Suspicion,
 * Sanity, Safe Haven, Greenpoint Restraint, Verified Flags, and Evidence/Tuner collection),
 * plus a dedicated Practice orientation completion report.
 */

import { ChapterId, SubwayLineId, getLineDefinition } from './route';
import { SanityTier } from './sanity';
import { SuspicionBand } from './suspicion';

export type CanonicalEndingId =
  | 'trial_collapsed'
  | 'nightmare_ghost'
  | 'unseen_home'
  | 'the_archivist'
  | 'hollow_passenger'
  | 'past_the_last_stop'
  | 'the_long_walk_up'
  | 'quiet_arrival';

export type EndingId = CanonicalEndingId | 'practice_complete';

export interface EndingDefinition {
  id: CanonicalEndingId;
  /** Strict evaluation priority (1 = checked first, 8 = default fallback) */
  priority: number;
  code: string;
  title: string;
  subtitle: string;
  requirementHint: string;
  tone: 'dark' | 'uneasy' | 'clean' | 'true';
}

export const ENDING_CATALOG: readonly EndingDefinition[] = [
  {
    id: 'trial_collapsed',
    priority: 1,
    code: 'END-01',
    title: 'Left on the Blank Platform',
    subtitle: 'Ending I · False Stop Collapse',
    requirementHint: 'Collapse during a 3-stage False Stop Trial after stepping through false doors.',
    tone: 'dark',
  },
  {
    id: 'nightmare_ghost',
    priority: 2,
    code: 'END-02',
    title: 'Ghost on the Local',
    subtitle: 'Ending II · Nightmare True Clear',
    requirementHint: 'Finish Nightmare Mode in CALM (<=24), 0 false positives, Safe Haven taken, Restraint held still.',
    tone: 'true',
  },
  {
    id: 'unseen_home',
    priority: 3,
    code: 'END-03',
    title: 'Unseen All the Way Home',
    subtitle: 'Ending III · Perfect Composure',
    requirementHint: 'Finish in CALM (<=24), Safe Haven taken, Restraint held still, 0 false stop exits, >=1 true flag.',
    tone: 'true',
  },
  {
    id: 'the_archivist',
    priority: 4,
    code: 'END-04',
    title: 'The Quiet Archivist',
    subtitle: 'Ending IV · Documented Evidence',
    requirementHint: 'Finish below WATCHED (<50) with >=3 evidence items (Polaroids/EVP/Tuner) and >=2 true flags.',
    tone: 'clean',
  },
  {
    id: 'hollow_passenger',
    priority: 5,
    code: 'END-05',
    title: 'The Hollow Passenger',
    subtitle: 'Ending V · Critical Sanity Drift',
    requirementHint: 'Reach terminus with Sanity <=2 and Suspicion <75 after refusing Safe Haven or slipping at Restraint.',
    tone: 'dark',
  },
  {
    id: 'past_the_last_stop',
    priority: 6,
    code: 'END-06',
    title: 'Past the Last Stop',
    subtitle: 'Ending VI · Hunted on Car B',
    requirementHint: 'Reach terminus in HUNTED (>=75 Suspicion) or after 2+ false stop exits.',
    tone: 'dark',
  },
  {
    id: 'the_long_walk_up',
    priority: 7,
    code: 'END-07',
    title: 'The Long Walk Up',
    subtitle: 'Ending VII · Watched Exit',
    requirementHint: 'Reach terminus in WATCHED (50–74), or after slipping at Restraint, or surviving a False Stop Trial.',
    tone: 'uneasy',
  },
  {
    id: 'quiet_arrival',
    priority: 8,
    code: 'END-08',
    title: 'Quiet Arrival',
    subtitle: 'Ending VIII · Standard Arrival',
    requirementHint: 'Complete the ride and step off cleanly at the real terminus.',
    tone: 'clean',
  },
] as const;

export interface EndingEvaluationInput {
  difficulty: 'standard' | 'practice' | 'nightmare';
  lineId: SubwayLineId;
  chapterId: ChapterId;
  finalSuspicion: number;
  finalSuspicionBand: SuspicionBand;
  finalSanity: number;
  finalSanityTier: SanityTier;
  trueFlags: number;
  falsePositives: number;
  safeHavenChoice: 'taken' | 'refused' | 'not_reached';
  restraintOutcome: 'held_still' | 'let_go' | 'not_reached';
  falseStopDisembarks: number;
  falseStopTrialsSurvived: number;
  falseStopTrialCollapsed: boolean;
  photosTaken: number;
  evpClipsRecorded: number;
  tunerSignalsLocked: number;
}

export interface EvaluatedEnding {
  endingId: EndingId;
  priority: number;
  code: string;
  title: string;
  subtitle: string;
  summary: string;
  tone: 'dark' | 'uneasy' | 'clean' | 'true';
}

/**
 * Evaluates which of the 8 priority-ranked endings (or practice completion) the ride earned.
 * Pure, deterministic, and strictly ordered from Priority 1 to Priority 8.
 */
export function evaluateEnding(input: EndingEvaluationInput): EvaluatedEnding {
  const line = getLineDefinition(input.lineId);
  const terminus = line.terminusName;
  const haven = line.safeHavenName;
  const totalEvidence = input.photosTaken + input.evpClipsRecorded + input.tunerSignalsLocked;

  // Priority 1: Collapsed in a False Stop Trial (overrides everything, even in chapters)
  if (input.falseStopTrialCollapsed) {
    return {
      endingId: 'trial_collapsed',
      priority: 1,
      code: 'END-01',
      title: 'Left on the Blank Platform',
      subtitle: `Ending I · False Stop Collapse (${line.id} Line)`,
      summary: `The doors of Car B slid shut while you were still trying to remember the order of the stops. Behind the yellow safety strip, the tiled wall has no station name at all — only the hum of fluorescent tubes and the sound of the ${line.id} train fading down the tunnel without you.`,
      tone: 'dark',
    };
  }

  // Practice orientation run
  if (input.difficulty === 'practice') {
    return {
      endingId: 'practice_complete',
      priority: 0,
      code: 'PRAC',
      title: 'Practice Run Complete',
      subtitle: `${line.name} Orientation Finished`,
      summary: `You completed the shortened ${line.id} train orientation loop. Ready for the full 13-stop ride all the way to ${terminus}.`,
      tone: 'clean',
    };
  }

  // Priority 2: Nightmare Ghost — Nightmare mode + CALM + 0 false positives + Safe Haven + Restraint held
  if (
    input.difficulty === 'nightmare' &&
    input.finalSuspicion <= 24 &&
    input.falsePositives === 0 &&
    input.safeHavenChoice === 'taken' &&
    input.restraintOutcome === 'held_still' &&
    input.falseStopDisembarks === 0
  ) {
    return {
      endingId: 'nightmare_ghost',
      priority: 2,
      code: 'END-02',
      title: 'Ghost on the Local',
      subtitle: `Ending II · Nightmare True Clear (${line.id} Line)`,
      summary: `Even at Nightmare pace on the ${line.id}, you never gave away a single blink. You took shelter at ${haven}, never flinched under the weight on your shoulders, logged zero false alarms, and stepped onto ${terminus} before Mom or Dad even rose from the fiberglass bench.`,
      tone: 'true',
    };
  }

  // Priority 3: Unseen All the Way Home — CALM + Safe Haven + Restraint held + 0 false stop exits + >=1 true flag
  if (
    input.finalSuspicion <= 24 &&
    input.safeHavenChoice === 'taken' &&
    input.restraintOutcome === 'held_still' &&
    input.falseStopDisembarks === 0 &&
    input.trueFlags >= 1
  ) {
    return {
      endingId: 'unseen_home',
      priority: 3,
      code: 'END-03',
      title: 'Unseen All the Way Home',
      subtitle: `Ending III · Perfect Composure (${line.id} Line)`,
      summary: `You noticed what changed in Car B, kept your face unreadable, sheltered at ${haven}, and held completely still when the weight pressed down. The stairwell up from ${terminus} smells like cold night air, and nobody asks what you counted.`,
      tone: 'true',
    };
  }

  // Priority 4: The Quiet Archivist — Suspicion < 50, >= 3 evidence items (Polaroids/EVP/Tuner), >= 2 true flags
  if (input.finalSuspicion < 50 && totalEvidence >= 3 && input.trueFlags >= 2) {
    return {
      endingId: 'the_archivist',
      priority: 4,
      code: 'END-04',
      title: 'The Quiet Archivist',
      subtitle: `Ending IV · Documented Evidence (${line.id} Line)`,
      summary: `You stepped onto the ${terminus} platform with Polaroids still developing in your coat pocket, cassette reels wound tight, and transit frequencies scribbled in your notebook. Whatever rides the ${line.id} after midnight is on record now.`,
      tone: 'clean',
    };
  }

  // Priority 5: The Hollow Passenger — Critical Sanity <= 2, Suspicion < 75, and refused Safe Haven OR failed Restraint
  if (
    input.finalSanity <= 2 &&
    input.finalSuspicion < 75 &&
    (input.safeHavenChoice === 'refused' || input.restraintOutcome === 'let_go')
  ) {
    return {
      endingId: 'hollow_passenger',
      priority: 5,
      code: 'END-05',
      title: 'The Hollow Passenger',
      subtitle: `Ending V · Critical Sanity Drift (${line.id} Line)`,
      summary: `Your pulse stayed steady enough to fool Mom and Dad, but by ${terminus} the fluorescent glare feels louder than your own thoughts. You stand when they stand, fold your hands the way Mom folds hers, and forget which stop you boarded at.`,
      tone: 'dark',
    };
  }

  // Priority 6: Past the Last Stop — HUNTED (>= 75) OR 2+ false stop exits
  if (input.finalSuspicion >= 75 || input.falseStopDisembarks >= 2) {
    return {
      endingId: 'past_the_last_stop',
      priority: 6,
      code: 'END-06',
      title: 'Past the Last Stop',
      subtitle: `Ending VI · Hunted on Car B (${line.id} Line)`,
      summary: `At ${terminus} the stainless doors slide open, pause a beat too short, and chime shut before you can stand. Dad glances up at the amber LED sign, smiles once, and says there is one more stop after the end of the line.`,
      tone: 'dark',
    };
  }

  // Priority 7: The Long Walk Up — WATCHED (50..74) OR let go at Restraint OR survived a False Stop Trial
  if (
    input.finalSuspicion >= 50 ||
    input.restraintOutcome === 'let_go' ||
    input.falseStopTrialsSurvived >= 1
  ) {
    return {
      endingId: 'the_long_walk_up',
      priority: 7,
      code: 'END-07',
      title: 'The Long Walk Up',
      subtitle: `Ending VII · Watched Exit (${line.id} Line)`,
      summary: `You made it off Car B at ${terminus}, though both parents stayed half a step behind you up the stairs, watching the back of your neck to see whether you would turn around toward the empty tunnel.`,
      tone: 'uneasy',
    };
  }

  // Priority 8: Quiet Arrival — Clean default arrival
  return {
    endingId: 'quiet_arrival',
    priority: 8,
    code: 'END-08',
    title: 'Quiet Arrival',
    subtitle: `Ending VIII · Standard Arrival (${line.id} Line)`,
    summary: `The doors open onto the real tile of ${terminus}. Mom stands first, Dad rests a steady hand on your shoulder, and the three of you walk up toward street level without mentioning the blank newspapers or the lights that flickered.`,
    tone: 'clean',
  };
}
