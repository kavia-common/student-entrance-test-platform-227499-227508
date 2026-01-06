/**
 * Scoring rules:
 * - Supports MCQ questions with points (default 1).
 * - Answers are keyed by questionId with selectedOptionId.
 * - Returns totalPoints, earnedPoints, percent (0-100), pass/fail, letter grade.
 */

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function letterGrade(percent) {
  if (percent >= 90) return 'A';
  if (percent >= 80) return 'B';
  if (percent >= 70) return 'C';
  if (percent >= 60) return 'D';
  return 'F';
}

// PUBLIC_INTERFACE
function scoreAttempt({ quiz, questions, answers }) {
  /** Compute score for an attempt given quiz settings, questions list, and submitted answers. */
  const answerByQ = new Map();
  for (const a of answers) {
    answerByQ.set(a.questionId, a.selectedOptionId);
  }

  let totalPoints = 0;
  let earnedPoints = 0;

  const breakdown = questions.map((q) => {
    const pts = typeof q.points === 'number' ? q.points : 1;
    totalPoints += pts;

    const selected = answerByQ.get(q.id);
    const correct = q.correctOptionId;
    const isCorrect = selected !== undefined && selected === correct;
    if (isCorrect) earnedPoints += pts;

    return {
      questionId: q.id,
      selectedOptionId: selected ?? null,
      correctOptionId: correct,
      isCorrect,
      points: pts,
      earnedPoints: isCorrect ? pts : 0,
    };
  });

  const percent = totalPoints === 0 ? 0 : clamp((earnedPoints / totalPoints) * 100, 0, 100);
  const passingPercent = typeof quiz.passingPercent === 'number' ? quiz.passingPercent : 60;
  const passed = percent >= passingPercent;

  return {
    totalPoints,
    earnedPoints,
    percent: Number(percent.toFixed(2)),
    passed,
    grade: letterGrade(percent),
    breakdown,
  };
}

module.exports = {
  scoreAttempt,
};
