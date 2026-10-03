// Survey questions are stored as surveys.questions jsonb:
//   [{ order, text, type, options? }]
// and an owner's answers as survey_responses.answers: { "<order>": value }.
// Staff write questions one per line; a prefix picks the question type.

export type QuestionType = 'text' | 'rating' | 'yes_no' | 'choice';

export type SurveyQuestion = {
  order: number;
  text: string;
  type: QuestionType;
  options?: string[];
};

export const QUESTION_HELP = [
  'Rating: How satisfied are you with landscaping?   (1 to 5 stars)',
  'Yes/No: Should the pool open earlier?',
  'Choice: Best night for meetings? | Monday | Tuesday | Wednesday',
  'Any other comments?   (no prefix: a written answer)',
];

const MAX_QUESTIONS = 50;
const MAX_TEXT = 500;

/** Parses the one-per-line question list; returns an error message for a bad line. */
export function parseQuestions(raw: string): { questions: SurveyQuestion[]; error: string | null } {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { questions: [], error: 'Add at least one question, one per line.' };
  if (lines.length > MAX_QUESTIONS) return { questions: [], error: `A survey can have at most ${MAX_QUESTIONS} questions.` };
  const questions: SurveyQuestion[] = [];
  for (const [i, line] of lines.entries()) {
    const m = /^(rating|yes\s*\/\s*no|choice)\s*:\s*(.*)$/i.exec(line);
    const kind = m ? m[1].toLowerCase().replace(/\s/g, '') : '';
    const rest = m ? m[2].trim() : line;
    let q: SurveyQuestion;
    if (kind === 'choice') {
      const [text, ...opts] = rest.split('|').map((s) => s.trim());
      const options = [...new Set(opts.filter(Boolean))];
      if (!text) return { questions: [], error: `Line ${i + 1}: the question is missing.` };
      if (options.length < 2) return { questions: [], error: `Line ${i + 1}: a choice question needs at least two options separated by |.` };
      q = { order: i + 1, text, type: 'choice', options };
    } else {
      if (!rest) return { questions: [], error: `Line ${i + 1}: the question is missing.` };
      q = { order: i + 1, text: rest, type: kind === 'rating' ? 'rating' : kind === 'yes/no' ? 'yes_no' : 'text' };
    }
    if (q.text.length > MAX_TEXT) return { questions: [], error: `Line ${i + 1}: keep questions under ${MAX_TEXT} characters.` };
    questions.push(q);
  }
  return { questions, error: null };
}

/** Reads stored questions, tolerating older rows that only had { text }. */
export function readQuestions(raw: unknown): SurveyQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((q: any, i: number) => ({
      order: Number.isInteger(q?.order) ? q.order : i + 1,
      text: String(q?.text ?? '').trim(),
      type: (['text', 'rating', 'yes_no', 'choice'].includes(q?.type) ? q.type : 'text') as QuestionType,
      options: Array.isArray(q?.options) ? q.options.map(String) : undefined,
    }))
    .filter((q) => q.text);
}

/** The editable one-per-line form of stored questions. */
export function questionsToText(questions: SurveyQuestion[]): string {
  return questions.map((q) => {
    switch (q.type) {
      case 'rating': return `Rating: ${q.text}`;
      case 'yes_no': return `Yes/No: ${q.text}`;
      case 'choice': return `Choice: ${q.text} | ${(q.options ?? []).join(' | ')}`;
      default: return q.text;
    }
  }).join('\n');
}

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  text: 'Written answer',
  rating: 'Rating 1–5',
  yes_no: 'Yes / No',
  choice: 'Multiple choice',
};

/** Validates one submitted answer; null means unanswered. */
export function readAnswer(q: SurveyQuestion, raw: string): string | number | null | { error: string } {
  const v = raw.trim();
  if (!v) return null;
  switch (q.type) {
    case 'rating': {
      const n = Number(v);
      return Number.isInteger(n) && n >= 1 && n <= 5 ? n : { error: `"${q.text}" needs a rating from 1 to 5.` };
    }
    case 'yes_no':
      return v === 'yes' || v === 'no' ? v : { error: `"${q.text}" needs Yes or No.` };
    case 'choice':
      return (q.options ?? []).includes(v) ? v : { error: `Choose one of the options for "${q.text}".` };
    default:
      return v.slice(0, 4000);
  }
}
