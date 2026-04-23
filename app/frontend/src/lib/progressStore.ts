// Local progress store backed by localStorage. No backend changes needed.
// Keyed by user id so different accounts on same device have separate data.

export type ActivityType =
  | 'quiz_ru_de'
  | 'quiz_de_ru'
  | 'dictation'
  | 'scramble'
  | 'conjugation'
  | 'speaking'
  | 'listening'
  | 'srs';

export interface ActivityRecord {
  type: ActivityType;
  correct: number;
  total: number;
  date: string; // YYYY-MM-DD
  timestamp: number;
}

export interface SRSCard {
  id: string; // hash of german_word
  german_word: string;
  russian_translation: string;
  kazakh_translation: string;
  part_of_speech: string;
  plural_form: string;
  gender: string;
  example_sentence: string;
  box: number; // 0-5 (Leitner-like)
  due: number; // timestamp when next review is due
  lastReviewed: number;
  createdAt: number;
}

export interface UserProgress {
  userId: string;
  activities: ActivityRecord[];
  lastActivityDate: string; // YYYY-MM-DD
  streak: number;
  longestStreak: number;
  dailyGoal: number; // target correct answers per day
  srsDeck: SRSCard[];
  totalCorrect: number;
  totalAnswered: number;
}

const STORAGE_PREFIX = 'de_progress_v1_';
const MAX_ACTIVITY_LOG = 500; // trim old entries

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const d1 = new Date(a + 'T00:00:00Z').getTime();
  const d2 = new Date(b + 'T00:00:00Z').getTime();
  return Math.round((d2 - d1) / 86_400_000);
}

function emptyProgress(userId: string): UserProgress {
  return {
    userId,
    activities: [],
    lastActivityDate: '',
    streak: 0,
    longestStreak: 0,
    dailyGoal: 20,
    srsDeck: [],
    totalCorrect: 0,
    totalAnswered: 0,
  };
}

export function loadProgress(userId: string): UserProgress {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + userId);
    if (!raw) return emptyProgress(userId);
    const parsed = JSON.parse(raw) as UserProgress;
    // Basic shape check
    if (!parsed.userId) parsed.userId = userId;
    if (!Array.isArray(parsed.activities)) parsed.activities = [];
    if (!Array.isArray(parsed.srsDeck)) parsed.srsDeck = [];
    if (typeof parsed.dailyGoal !== 'number') parsed.dailyGoal = 20;
    if (typeof parsed.streak !== 'number') parsed.streak = 0;
    if (typeof parsed.longestStreak !== 'number') parsed.longestStreak = 0;
    if (typeof parsed.totalCorrect !== 'number') parsed.totalCorrect = 0;
    if (typeof parsed.totalAnswered !== 'number') parsed.totalAnswered = 0;
    return parsed;
  } catch {
    return emptyProgress(userId);
  }
}

export function saveProgress(progress: UserProgress): void {
  try {
    const trimmed: UserProgress = {
      ...progress,
      activities: progress.activities.slice(-MAX_ACTIVITY_LOG),
    };
    localStorage.setItem(STORAGE_PREFIX + progress.userId, JSON.stringify(trimmed));
  } catch {
    // ignore quota errors
  }
}

export function recordActivity(
  userId: string,
  type: ActivityType,
  correct: number,
  total: number,
): UserProgress {
  const p = loadProgress(userId);
  const today = getTodayStr();

  // Update streak
  if (p.lastActivityDate === today) {
    // same day, no streak change
  } else if (p.lastActivityDate === '') {
    p.streak = 1;
  } else {
    const diff = daysBetween(p.lastActivityDate, today);
    if (diff === 1) {
      p.streak += 1;
    } else if (diff > 1) {
      p.streak = 1;
    }
  }
  p.lastActivityDate = today;
  p.longestStreak = Math.max(p.longestStreak, p.streak);

  p.totalCorrect += correct;
  p.totalAnswered += total;
  p.activities.push({
    type,
    correct,
    total,
    date: today,
    timestamp: Date.now(),
  });

  saveProgress(p);
  return p;
}

export function setDailyGoal(userId: string, goal: number): UserProgress {
  const p = loadProgress(userId);
  p.dailyGoal = Math.max(1, Math.min(500, Math.round(goal)));
  saveProgress(p);
  return p;
}

export function getTodayCorrectCount(p: UserProgress): number {
  const today = getTodayStr();
  return p.activities
    .filter((a) => a.date === today)
    .reduce((sum, a) => sum + a.correct, 0);
}

export function getLast7DaysStats(p: UserProgress): Array<{ date: string; correct: number; total: number }> {
  const result: Array<{ date: string; correct: number; total: number }> = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayActivities = p.activities.filter((a) => a.date === dateStr);
    result.push({
      date: dateStr,
      correct: dayActivities.reduce((s, a) => s + a.correct, 0),
      total: dayActivities.reduce((s, a) => s + a.total, 0),
    });
  }
  return result;
}

export function getActivityBreakdown(p: UserProgress): Record<ActivityType, { correct: number; total: number }> {
  const breakdown: Record<ActivityType, { correct: number; total: number }> = {
    quiz_ru_de: { correct: 0, total: 0 },
    quiz_de_ru: { correct: 0, total: 0 },
    dictation: { correct: 0, total: 0 },
    scramble: { correct: 0, total: 0 },
    conjugation: { correct: 0, total: 0 },
    speaking: { correct: 0, total: 0 },
    listening: { correct: 0, total: 0 },
    srs: { correct: 0, total: 0 },
  };
  for (const a of p.activities) {
    if (breakdown[a.type]) {
      breakdown[a.type].correct += a.correct;
      breakdown[a.type].total += a.total;
    }
  }
  return breakdown;
}

// ---------- SRS (Leitner-like) ----------

const BOX_INTERVALS_MS = [
  10 * 60 * 1000, // box 0: 10 min
  1 * 24 * 60 * 60 * 1000, // box 1: 1 day
  3 * 24 * 60 * 60 * 1000, // box 2: 3 days
  7 * 24 * 60 * 60 * 1000, // box 3: 7 days
  14 * 24 * 60 * 60 * 1000, // box 4: 14 days
  30 * 24 * 60 * 60 * 1000, // box 5: 30 days
];

function hashWord(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return `w_${Math.abs(h).toString(36)}`;
}

export function addToSRS(userId: string, card: Omit<SRSCard, 'id' | 'box' | 'due' | 'lastReviewed' | 'createdAt'>): UserProgress {
  const p = loadProgress(userId);
  const id = hashWord(card.german_word.toLowerCase().trim());
  const existing = p.srsDeck.find((c) => c.id === id);
  if (existing) {
    // refresh data but keep learning progress
    Object.assign(existing, card);
  } else {
    p.srsDeck.push({
      ...card,
      id,
      box: 0,
      due: Date.now(),
      lastReviewed: 0,
      createdAt: Date.now(),
    });
  }
  saveProgress(p);
  return p;
}

export function removeFromSRS(userId: string, cardId: string): UserProgress {
  const p = loadProgress(userId);
  p.srsDeck = p.srsDeck.filter((c) => c.id !== cardId);
  saveProgress(p);
  return p;
}

export function getDueCards(p: UserProgress, limit = 20): SRSCard[] {
  const now = Date.now();
  return p.srsDeck
    .filter((c) => c.due <= now)
    .sort((a, b) => a.due - b.due)
    .slice(0, limit);
}

export function rateSRSCard(
  userId: string,
  cardId: string,
  rating: 'again' | 'hard' | 'good' | 'easy',
): UserProgress {
  const p = loadProgress(userId);
  const card = p.srsDeck.find((c) => c.id === cardId);
  if (!card) return p;
  const now = Date.now();
  card.lastReviewed = now;
  switch (rating) {
    case 'again':
      card.box = 0;
      break;
    case 'hard':
      card.box = Math.max(0, card.box);
      break;
    case 'good':
      card.box = Math.min(5, card.box + 1);
      break;
    case 'easy':
      card.box = Math.min(5, card.box + 2);
      break;
  }
  card.due = now + BOX_INTERVALS_MS[card.box];
  saveProgress(p);
  return p;
}

export function getSRSStats(p: UserProgress): {
  total: number;
  due: number;
  mastered: number; // box >= 4
  learning: number; // box < 4
} {
  const now = Date.now();
  return {
    total: p.srsDeck.length,
    due: p.srsDeck.filter((c) => c.due <= now).length,
    mastered: p.srsDeck.filter((c) => c.box >= 4).length,
    learning: p.srsDeck.filter((c) => c.box < 4).length,
  };
}