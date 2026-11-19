/**
 * Parents' Dialogue, Mask Questions, and Background Intercom Announcements.
 */

export interface ParentExchange {
  id: string;
  lines: Array<{ speaker: 'Mom' | 'Dad'; text: string; durationSec: number }>;
}

export interface MaskQuestionOption {
  id: string;
  text: string;
  isCalm: boolean;
}

export interface MaskQuestion {
  id: string;
  speaker: 'Mom' | 'Dad';
  prompt: string;
  options: [MaskQuestionOption, MaskQuestionOption, MaskQuestionOption];
  timeoutSec: number;
}

export const PARENT_EXCHANGES: readonly ParentExchange[] = [
  {
    id: 'sister_call',
    lines: [
      { speaker: 'Mom', text: 'Did you ever call your sister back?', durationSec: 3.4 },
      { speaker: 'Dad', text: 'Tonight. Remind me.', durationSec: 2.8 },
    ],
  },
  {
    id: 'keys_check',
    lines: [
      { speaker: 'Dad', text: 'You brought the spare set for the downstairs door, right?', durationSec: 3.6 },
      { speaker: 'Mom', text: 'Front pocket. Don’t start.', durationSec: 2.8 },
    ],
  },
  {
    id: 'late_train',
    lines: [
      { speaker: 'Mom', text: 'The G always runs slower after ten.', durationSec: 3.2 },
      { speaker: 'Dad', text: 'It’s not ten anymore.', durationSec: 2.8 },
    ],
  },
  {
    id: 'coat_button',
    lines: [
      { speaker: 'Dad', text: 'Aren’t you warm with that buttoned all the way up?', durationSec: 3.5 },
      { speaker: 'Mom', text: 'Draft comes off the doors.', durationSec: 2.8 },
    ],
  },
  {
    id: 'groceries',
    lines: [
      { speaker: 'Mom', text: 'We forgot milk again.', durationSec: 2.8 },
      { speaker: 'Dad', text: 'Corner place on Jackson is still open.', durationSec: 3.4 },
    ],
  },
  {
    id: 'unasked_answer',
    lines: [
      { speaker: 'Dad', text: 'No, we didn’t pass it yet. Stop asking.', durationSec: 3.8 },
      { speaker: 'Mom', text: 'Nobody said anything.', durationSec: 2.8 },
    ],
  },
];

export const MASK_QUESTIONS: readonly MaskQuestion[] = [
  {
    id: 'quiet_hon',
    speaker: 'Mom',
    prompt: "You've been quiet. You okay, hon?",
    timeoutSec: 11,
    options: [
      { id: 'calm', text: "Yeah, just tired. I'm fine.", isCalm: true },
      { id: 'wrong_1', text: 'Did you see that poster just change?', isCalm: false },
      { id: 'wrong_2', text: "Why isn't anyone blinking?", isCalm: false },
    ],
  },
  {
    id: 'looking_at',
    speaker: 'Dad',
    prompt: "What do you keep looking down the car for?",
    timeoutSec: 10,
    options: [
      { id: 'wrong_1', text: 'There was nobody sitting there a minute ago.', isCalm: false },
      { id: 'calm', text: 'Just checking the map for how many stops are left.', isCalm: true },
      { id: 'wrong_2', text: "I don't think this is the real G train.", isCalm: false },
    ],
  },
  {
    id: 'stop_count',
    speaker: 'Mom',
    prompt: "How many stops till Court Square? You always count.",
    timeoutSec: 10,
    options: [
      { id: 'wrong_1', text: 'The strip map is wrong. A stop moved.', isCalm: false },
      { id: 'wrong_2', text: 'We should get off right now.', isCalm: false },
      { id: 'calm', text: 'Not many. Almost home.', isCalm: true },
    ],
  },
  {
    id: 'sit_still',
    speaker: 'Dad',
    prompt: "You're fidgeting. Everything alright?",
    timeoutSec: 9.5,
    options: [
      { id: 'calm', text: 'Seat is hard. Just shifting.', isCalm: true },
      { id: 'wrong_1', text: 'Why are you watching me like that?', isCalm: false },
      { id: 'wrong_2', text: 'The lights keep cutting out.', isCalm: false },
    ],
  },
  {
    id: 'almost_there',
    speaker: 'Mom',
    prompt: "Keep your eyes forward, sweetheart. Don't stare at people.",
    timeoutSec: 9,
    options: [
      { id: 'wrong_1', text: "There's nobody in the car anymore!", isCalm: false },
      { id: 'calm', text: 'Sorry. Looking ahead.', isCalm: true },
      { id: 'wrong_2', text: 'The guy with the newspaper has blank pages.', isCalm: false },
    ],
  },
];

/**
 * Random background intercom announcements played between stops on a timer,
 * deliberately unrelated to stop types so they never act as a cheat signal.
 */
export const BACKGROUND_PA_ANNOUNCEMENTS: readonly string[] = [
  'Stand clear of the closing doors, please.',
  'If you see something, say something. Notify a police officer or MTA employee.',
  'Please keep your belongings off the seats during evening service.',
  'Local service is operating with minor signal spacing delays.',
  'Mind the gap between the train and the platform.',
  'Thank you for riding with New York City Transit.',
  'Please offer priority seating to seniors and riders with disabilities.',
  'Smoking and vaping are prohibited in all stations and subway cars.',
];

export function shuffleMaskOptions(
  question: MaskQuestion,
  rng: () => number = Math.random,
): MaskQuestion {
  const opts = [...question.options].sort(() => rng() - 0.5) as [
    MaskQuestionOption,
    MaskQuestionOption,
    MaskQuestionOption,
  ];
  return { ...question, options: opts };
}
