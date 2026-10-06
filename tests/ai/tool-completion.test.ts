import { afterEach, describe, expect, it, vi } from 'vitest';
import { toolCompletion, toolResultText, type AITool } from '@/lib/ai/service';
import { clampLimit, cleanText, likeEscape, portfolioToolsFor, quotedFilterValue, runPortfolioTool } from '@/lib/ai/portfolio-tools';

const tools: AITool[] = [
  { name: 'unit_summary', description: 'unit', parameters: { type: 'object', properties: { unit_number: { type: 'string' } } } },
];

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('toolCompletion', () => {
  it('runs an OpenAI-style tool call and returns the final answer', async () => {
    const bodies: any[] = [];
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return bodies.length === 1
        ? jsonResponse({ choices: [{ message: { content: null, tool_calls: [
            { id: 'c1', type: 'function', function: { name: 'unit_summary', arguments: '{"unit_number":"301"}' } },
          ] } }] })
        : jsonResponse({ choices: [{ message: { content: 'Unit 301 owes $50.00.' } }] });
    });
    vi.stubGlobal('fetch', fetchMock);
    const execute = vi.fn(async () => ({ unit: '301', balance_due: 50 }));

    const answer = await toolCompletion(
      { provider: 'openai', model: 'gpt-test', apiKey: 'sk-test-12345' },
      'system', [{ role: 'user', content: 'What does 301 owe?' }], tools, execute,
    );

    expect(answer).toBe('Unit 301 owes $50.00.');
    expect(execute).toHaveBeenCalledWith('unit_summary', { unit_number: '301' });
    expect(bodies[0].tools[0].function.name).toBe('unit_summary');
    expect(bodies[1].messages.at(-1)).toMatchObject({ role: 'tool', tool_call_id: 'c1' });
    expect(bodies[1].messages.at(-1).content).toContain('"balance_due":50');
  });

  it('sends DeepSeek reasoning back with the tool results', async () => {
    const bodies: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return bodies.length === 1
        ? jsonResponse({ choices: [{ message: { content: '', reasoning_content: 'think', tool_calls: [
            { id: 'r1', type: 'function', function: { name: 'unit_summary', arguments: '{}' } },
          ] } }] })
        : jsonResponse({ choices: [{ message: { content: 'done' } }] });
    }));

    await toolCompletion({ provider: 'deepseek', model: 'deepseek-reasoner', apiKey: 'sk-test-12345' }, 's', [{ role: 'user', content: 'q' }], tools, async () => ({}));

    const assistant = bodies[1].messages.find((m: any) => m.role === 'assistant');
    expect(assistant.reasoning_content).toBe('think');
  });

  it('runs an Anthropic tool_use block and returns the final text', async () => {
    const bodies: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return bodies.length === 1
        ? jsonResponse({ content: [{ type: 'tool_use', id: 't1', name: 'unit_summary', input: { unit_number: '12' } }] })
        : jsonResponse({ content: [{ type: 'text', text: 'Unit 12 is paid up.' }] });
    }));
    const execute = vi.fn(async () => ({ balance_due: 0 }));

    const answer = await toolCompletion(
      { provider: 'anthropic', model: 'claude-test', apiKey: 'sk-ant-12345' },
      'system', [{ role: 'user', content: 'Unit 12?' }], tools, execute,
    );

    expect(answer).toBe('Unit 12 is paid up.');
    expect(bodies[0].system).toBe('system');
    expect(bodies[0].tools[0].input_schema).toBeDefined();
    const last = bodies[1].messages.at(-1);
    expect(last.role).toBe('user');
    expect(last.content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 't1' });
  });

  it('never runs a tool that is not on the allow-list', async () => {
    const bodies: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return bodies.length === 1
        ? jsonResponse({ choices: [{ message: { tool_calls: [
            { id: 'x', type: 'function', function: { name: 'delete_everything', arguments: '{}' } },
          ] } }] })
        : jsonResponse({ choices: [{ message: { content: 'I can only read.' } }] });
    }));
    const execute = vi.fn();

    await toolCompletion({ provider: 'openai', model: 'gpt-test', apiKey: 'sk-test-12345' }, 's', [{ role: 'user', content: 'q' }], tools, execute);

    expect(execute).not.toHaveBeenCalled();
    expect(bodies[1].messages.at(-1).content).toContain('Unknown tool');
  });

  it('stops offering tools after the round cap', async () => {
    const bodies: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      bodies.push(body);
      return body.tools
        ? jsonResponse({ choices: [{ message: { tool_calls: [
            { id: `c${bodies.length}`, type: 'function', function: { name: 'unit_summary', arguments: '{}' } },
          ] } }] })
        : jsonResponse({ choices: [{ message: { content: 'done' } }] });
    }));

    const answer = await toolCompletion(
      { provider: 'openai', model: 'gpt-test', apiKey: 'sk-test-12345' },
      's', [{ role: 'user', content: 'q' }], tools, async () => ({}), { maxRounds: 2 },
    );

    expect(answer).toBe('done');
    expect(bodies).toHaveLength(3);
    expect(bodies[2].tools).toBeUndefined();
  });
});

describe('toolCompletion call caps', () => {
  it('runs at most 4 lookups from one model response', async () => {
    const bodies: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return bodies.length === 1
        ? jsonResponse({ choices: [{ message: { tool_calls: Array.from({ length: 7 }, (_, i) => (
            { id: `c${i}`, type: 'function', function: { name: 'unit_summary', arguments: '{}' } })) } }] })
        : jsonResponse({ choices: [{ message: { content: 'ok' } }] });
    }));
    const execute = vi.fn(async () => ({}));

    await toolCompletion({ provider: 'openai', model: 'gpt-test', apiKey: 'sk-test-12345' }, 's', [{ role: 'user', content: 'q' }], tools, execute);

    expect(execute).toHaveBeenCalledTimes(4);
    const toolMessages = bodies[1].messages.filter((m: any) => m.role === 'tool');
    expect(toolMessages).toHaveLength(7); // every call still gets a reply
    expect(toolMessages[6].content).toContain('limit reached');
  });
});

describe('toolCompletion time budget', () => {
  it('stops offering tools once most of the time budget is used', async () => {
    let now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const bodies: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      bodies.push(body);
      now += 4_000; // each provider call "takes" 4 seconds
      return body.tools
        ? jsonResponse({ choices: [{ message: { tool_calls: [
            { id: `c${bodies.length}`, type: 'function', function: { name: 'unit_summary', arguments: '{}' } },
          ] } }] })
        : jsonResponse({ choices: [{ message: { content: 'out of time' } }] });
    }));

    const answer = await toolCompletion(
      { provider: 'openai', model: 'gpt-test', apiKey: 'sk-test-12345' },
      's', [{ role: 'user', content: 'q' }], tools, async () => ({}), { maxRounds: 5, timeBudgetMs: 10_000 },
    );

    expect(answer).toBe('out of time');
    // 10s budget: round 0 at 0s, round 1 at 4s (6s left), round 2 at 8s (2s < 2.5s) → final, no tools.
    expect(bodies).toHaveLength(3);
    expect(bodies[2].tools).toBeUndefined();
    vi.restoreAllMocks();
  });
});

describe('portfolio tool input guards', () => {
  it('keeps punctuation used in names and escapes LIKE wildcards', () => {
    expect(cleanText('  Condo Towers,   Inc. ')).toBe('Condo Towers, Inc.');
    expect(cleanText('a'.repeat(200))).toHaveLength(80);
    expect(likeEscape("O'Brien, Jr.")).toBe("O'Brien, Jr.");
    expect(likeEscape('100%_a*b\\c')).toBe('100\\%\\_ab\\\\c');
  });

  it('double-quotes values used inside a PostgREST or() filter', () => {
    expect(quotedFilterValue('%Habte, Sr%')).toBe('"%Habte, Sr%"');
    expect(quotedFilterValue('%say "hi"%')).toBe('"%say \\"hi\\"%"');
    expect(quotedFilterValue('%100\\%%')).toBe('"%100\\\\%%"');
  });

  it('clamps list sizes to 1..50', () => {
    expect(clampLimit(undefined)).toBe(25);
    expect(clampLimit(500)).toBe(50);
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit('7')).toBe(7);
  });
});

describe('finance access', () => {
  it('leaves finance lookups out for staff without finance access', () => {
    const names = (canSee: boolean) => portfolioToolsFor(canSee).map((t) => t.name);
    expect(names(true)).toEqual(expect.arrayContaining(['list_delinquent_units', 'list_bills']));
    expect(names(false)).not.toContain('list_delinquent_units');
    expect(names(false)).not.toContain('list_bills');
    expect(names(false)).toContain('unit_summary');
  });

  it('refuses a finance lookup for staff without finance access', async () => {
    await expect(runPortfolioTool('list_bills', { status: 'approved' }, false))
      .resolves.toEqual({ error: 'Financial details are not available to your role.' });
  });
});

describe('tool result size cap', () => {
  it('drops rows instead of cutting JSON and keeps the envelope accurate', () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ id: i, memo: 'x'.repeat(280) }));
    const text = toolResultText({ total: 80, returned: 50, truncated: true, rows });
    expect(text.length).toBeLessThanOrEqual(12_000);
    const parsed = JSON.parse(text);
    expect(parsed.total).toBe(80);
    expect(parsed.returned).toBe(parsed.rows.length);
    expect(parsed.rows.length).toBeLessThan(50);
    expect(parsed.truncated).toBe(true);
  });

  it('shortens very long strings and wraps bare arrays', () => {
    const rows = Array.from({ length: 60 }, () => ({ note: 'y'.repeat(5_000) }));
    const parsed = JSON.parse(toolResultText(rows));
    expect(parsed.total).toBe(60);
    expect(parsed.rows[0].note.length).toBeLessThanOrEqual(301);
    expect(parsed.returned).toBe(parsed.rows.length);
  });

  it('leaves small results untouched', () => {
    expect(toolResultText({ a: 1 })).toBe('{"a":1}');
  });
});
