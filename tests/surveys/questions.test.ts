import { describe, expect, it } from 'vitest';
import { parseQuestions, questionsToText, readAnswer, readQuestions } from '@/lib/surveys/questions';

describe('survey questions', () => {
  it('parses each question type from its prefix', () => {
    const { questions, error } = parseQuestions([
      'Rating: How is landscaping?',
      'Yes/No: Open the pool earlier?',
      'Choice: Best night? | Monday | Tuesday',
      'Any other comments?',
    ].join('\n'));
    expect(error).toBeNull();
    expect(questions.map((q) => q.type)).toEqual(['rating', 'yes_no', 'choice', 'text']);
    expect(questions[2].options).toEqual(['Monday', 'Tuesday']);
    expect(questions.map((q) => q.order)).toEqual([1, 2, 3, 4]);
  });

  it('rejects a choice question with fewer than two options', () => {
    expect(parseQuestions('Choice: Pick one | Only').error).toMatch(/at least two options/);
  });

  it('round-trips through the editable text', () => {
    const text = 'Rating: A\nYes/No: B\nChoice: C | x | y\nD';
    expect(questionsToText(parseQuestions(text).questions)).toBe(text);
  });

  it('reads older rows that only stored text', () => {
    expect(readQuestions([{ order: 1, text: 'Old', type: 'text' }, { text: 'No type' }])).toEqual([
      { order: 1, text: 'Old', type: 'text', options: undefined },
      { order: 2, text: 'No type', type: 'text', options: undefined },
    ]);
  });

  it('validates answers by type', () => {
    const [rating, yesNo, choice] = parseQuestions('Rating: A\nYes/No: B\nChoice: C | x | y').questions;
    expect(readAnswer(rating, '4')).toBe(4);
    expect(readAnswer(rating, '6')).toEqual({ error: expect.any(String) });
    expect(readAnswer(yesNo, 'yes')).toBe('yes');
    expect(readAnswer(choice, 'z')).toEqual({ error: expect.any(String) });
    expect(readAnswer(choice, '')).toBeNull();
  });
});
