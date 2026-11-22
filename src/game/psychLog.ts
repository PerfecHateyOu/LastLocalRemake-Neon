/**
 * 13-Case Psychological Log — Last Local
 * One structured clinical dossier file (CASE 01 .. CASE 13) for each stop on the ride.
 * Tracks what happened at each station without ever revealing mid-ride flag accuracy.
 */

import { FlagLogEntry } from './anomalies';
import { SubwayLineId, getStopsForLine } from './route';

export interface PsychCaseTemplate {
  caseNumber: number; // 1..13
  code: string;
  clinicalTitle: string;
  baselineNote: string;
  escalatedNote: string;
}

export interface PsychCaseEntry {
  caseNumber: number;
  code: string;
  stopName: string;
  clinicalTitle: string;
  status: 'unvisited' | 'observed' | 'flagged' | 'incident';
  summaryNote: string;
  flagCount: number;
}

export const PSYCH_CASE_TEMPLATES: readonly PsychCaseTemplate[] = [
  {
    caseNumber: 1,
    code: 'CASE 01',
    clinicalTitle: 'Baseline Boarding',
    baselineNote: 'Subject seated across from parents in Car B. Initial posture flat; four other riders accounted for.',
    escalatedNote: 'Early vigilance recorded before train cleared first platform.',
  },
  {
    caseNumber: 2,
    code: 'CASE 02',
    clinicalTitle: 'Fluorescent Stillness',
    baselineNote: 'Over-lit clinical interior established. Subject tracking paper ads and brushed stanchions.',
    escalatedNote: 'First peripheral fixations noted; parental gaze interval shortened.',
  },
  {
    caseNumber: 3,
    code: 'CASE 03',
    clinicalTitle: 'Counting the Riders',
    baselineNote: 'Newspaper pages remain unprinted white; grocery-bag passenger oriented toward glass.',
    escalatedNote: 'Subject logged discrepancies while attempting neutral facial posture.',
  },
  {
    caseNumber: 4,
    code: 'CASE 04',
    clinicalTitle: 'First False Platform',
    baselineNote: 'Signage drift observed on overhead LED. Forgiving false-stop threshold tested.',
    escalatedNote: 'Disembarkation incident logged at unscheduled platform; elevated cortisol.',
  },
  {
    caseNumber: 5,
    code: 'CASE 05',
    clinicalTitle: 'Sanity Ceiling Drop',
    baselineNote: 'Per-stop ceiling shifted downward. Heartbeat variability beginning to widen.',
    escalatedNote: 'Multiple visual anomalies logged before mid-line shelter approach.',
  },
  {
    caseNumber: 6,
    code: 'CASE 06',
    clinicalTitle: 'The Safe Haven Choice',
    baselineNote: 'Platform alcove offered brief respite before tunnel power loss.',
    escalatedNote: 'Refusal of shelter correlated with sharp suspicion rise and parent scrutiny.',
  },
  {
    caseNumber: 7,
    code: 'CASE 07',
    clinicalTitle: 'Post-Blackout Re-entry',
    baselineNote: 'Single tube flicker ended; cabin lights restored after prolonged tunnel dark stretch.',
    escalatedNote: 'Post-blackout disorientation triggered rapid scanning across seating bays.',
  },
  {
    caseNumber: 8,
    code: 'CASE 08',
    clinicalTitle: 'Mid-Route Drift',
    baselineNote: 'Sanity band tightened to 30–70. Decoy visual artifacts indistinguishable from real shifts.',
    escalatedNote: 'Frequent glances from left bench documented during cruising phase.',
  },
  {
    caseNumber: 9,
    code: 'CASE 09',
    clinicalTitle: 'The Lying Intercom',
    baselineNote: 'PA prematurely declared final terminus. Subject tested on trusting route count over voice.',
    escalatedNote: 'Subject reacted to deceptive terminus broadcast; severe false-stop hazard recorded.',
  },
  {
    caseNumber: 10,
    code: 'CASE 10',
    clinicalTitle: 'Tunnel Compression',
    baselineNote: 'Sanity band narrowed to 5–30. Anxious breathing measurably constricted peripheral field.',
    escalatedNote: 'High-frequency heartbeat jitter persisted throughout station dwell.',
  },
  {
    caseNumber: 11,
    code: 'CASE 11',
    clinicalTitle: 'Physical Restraint',
    baselineNote: 'Tactile pressure on both shoulders prior to door release. Complete stillness required.',
    escalatedNote: 'Movement during restraint provoked immediate spike in suspicion and visual tearing.',
  },
  {
    caseNumber: 12,
    code: 'CASE 12',
    clinicalTitle: 'Forced Bait',
    baselineNote: 'Deliberate cabin flicker and vocal lure deployed one stop shy of terminus.',
    escalatedNote: 'Subject struggled to hold straight-ahead focus during final tunnel approach.',
  },
  {
    caseNumber: 13,
    code: 'CASE 13',
    clinicalTitle: 'Terminus Assessment',
    baselineNote: 'True final stop reached. Full ride metrics sealed for travel report evaluation.',
    escalatedNote: 'Arrival completed under sustained parental observation.',
  },
] as const;

export function buildPsychCaseLog(params: {
  lineId: SubwayLineId;
  highestStopReached: number;
  flagLog: readonly FlagLogEntry[];
  safeHavenChoice: 'taken' | 'refused' | 'not_reached';
  restraintOutcome: 'held_still' | 'let_go' | 'not_reached';
  falseStopIncidentStops: readonly number[];
}): PsychCaseEntry[] {
  const stops = getStopsForLine(params.lineId);

  return PSYCH_CASE_TEMPLATES.map((tpl) => {
    const stop = stops[tpl.caseNumber - 1];
    const flagsAtStop = params.flagLog.filter((f) => f.stopNumber === tpl.caseNumber);
    const hadFalseStopIncident = params.falseStopIncidentStops.includes(tpl.caseNumber);
    const reached = tpl.caseNumber <= params.highestStopReached;

    let status: PsychCaseEntry['status'] = 'unvisited';
    let summaryNote = 'Unopened — reach this station to log field notes.';

    if (reached) {
      const hadEscalation =
        hadFalseStopIncident ||
        (tpl.caseNumber === 6 && params.safeHavenChoice === 'refused') ||
        (tpl.caseNumber === 11 && params.restraintOutcome === 'let_go');

      if (hadEscalation) {
        status = 'incident';
        summaryNote = tpl.escalatedNote;
      } else if (flagsAtStop.length > 0) {
        status = 'flagged';
        summaryNote = `${tpl.baselineNote} (${flagsAtStop.length} observation${flagsAtStop.length === 1 ? '' : 's'} logged.)`;
      } else {
        status = 'observed';
        summaryNote = tpl.baselineNote;
      }
    }

    return {
      caseNumber: tpl.caseNumber,
      code: tpl.code,
      stopName: stop?.name ?? `Stop ${tpl.caseNumber}`,
      clinicalTitle: tpl.clinicalTitle,
      status,
      summaryNote,
      flagCount: flagsAtStop.length,
    };
  });
}
