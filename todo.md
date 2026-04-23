# German Learning App — Major Feature Expansion

## Requested Features (user-approved)
1. **Reverse Quiz Mode** — show German word, user types Russian translation
2. **Dictation** — AI speaks a word/phrase, user writes what they heard
3. **SRS Flashcards** — spaced repetition review system
4. **Stats & Progress** — charts, streaks, daily goals
5. **Verb Conjugation Trainer** — practice verb forms
6. **Listening Comprehension** — AI reads text, user answers questions
7. **Sentence Scramble** — assemble correct word order from scattered words

## Strategy (to fit within file-count limits)
- Integrate new training modes as **sub-modes inside Quiz tab** (dropdown: "Тип квиза") rather than separate tabs → avoids tab overflow.
- Create ONE new tab: **"Прогресс"** for stats/streaks (separate because it's not a training mode).
- Create ONE new tab: **"SRS"** for flashcard review (core repeat concept, needs dedicated UI).
- Store local stats + SRS progress in `localStorage` (keyed by user id) — no backend changes needed for MVP.

## Development Tasks
- [ ] Create `lib/progressStore.ts` — localStorage-backed stats, streaks, daily goal, SRS deck
- [ ] Extend `lib/quizGenerator.ts` with: `generateDictationPhrase`, `generateListeningPassage`, `generateScrambleSentence`, `generateConjugationTask`
- [ ] Refactor `QuizPage.tsx` to support mode selection: vocab-ru→de (existing), vocab-de→ru (reverse), dictation, scramble, conjugation
- [ ] Create `ListeningPage.tsx` component (listening comprehension with questions)
- [ ] Create `SRSPage.tsx` component (flashcard review with show/rate flow)
- [ ] Create `ProgressPage.tsx` component (stats, streak, daily goal, charts)
- [ ] Update `Index.tsx`: add tabs "Аудирование", "Карточки", "Прогресс"; lazy-load all
- [ ] Wire stats recording from all quiz modes, speaking, SRS into progressStore
- [ ] Run lint + build, fix issues

## File Budget
- lib/progressStore.ts (new)
- lib/quizGenerator.ts (extend)
- components/QuizPage.tsx (major refactor)
- components/ListeningPage.tsx (new)
- components/SRSPage.tsx (new)
- components/ProgressPage.tsx (new)
- pages/Index.tsx (add tabs)
= 7 files total (within 8-file limit)

## Notes on scope trimming (MVP)
- SRS uses simple SM-2-lite algorithm (intervals: 1d, 3d, 7d, 14d, 30d based on rating)
- Stats: total answered, correct %, streak days, today count — no heavy chart lib, just CSS bars
- Verb conjugation integrated as quiz mode (not separate tab) — reuses quiz flow
- Listening = short paragraph + 2-3 RU questions with text input