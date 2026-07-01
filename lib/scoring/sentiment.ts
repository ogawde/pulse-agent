/**
 * Team-level sentiment scoring. Processes message text in memory only — never persisted.
 */

function appReferer(): string {
  return process.env.PULSE_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://pulse.app'
}

export function scoreAlgorithmic(text: string): number {
  const lower = text.toLowerCase()
  const negativeWords = [
    'stressed',
    'overwhelmed',
    'frustrated',
    'burnout',
    'tired',
    'urgent',
    'blocked',
    'behind',
    'worried',
    'angry',
    'stupid',
    'terrible',
    'awful',
    'failed',
    'disappointed',
    'unacceptable',
  ]
  const positiveWords = [
    'great',
    'excellent',
    'good',
    'well done',
    'thanks',
    'appreciate',
    'helpful',
    'amazing',
    'shipped',
    'celebrate',
    'happy',
    'wonderful',
  ]
  const afterHoursPattern =
    /urgent|asap|immediately|need this now|right now|can you just|why haven't you/i

  let score = 0
  for (const word of negativeWords) {
    if (lower.includes(word)) score -= 0.2
  }
  for (const word of positiveWords) {
    if (lower.includes(word)) score += 0.15
  }
  if (afterHoursPattern.test(text)) score -= 0.1

  return Math.max(-1, Math.min(1, score))
}

async function scoreWithOpenRouter(text: string): Promise<number> {
  const model = process.env.OPENROUTER_MODEL ?? 'openrouter/free'

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': appReferer(),
      'X-Title': 'Pulse Team Health',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'Score workplace team channel sentiment from -1.0 (very negative/stressed) to 1.0 (positive/supportive). Return ONLY a decimal number.',
        },
        { role: 'user', content: text },
      ],
      max_tokens: 10,
      temperature: 0,
    }),
  })

  if (!response.ok) throw new Error(`OpenRouter error: ${response.status}`)

  const data = await response.json()
  const score = Number.parseFloat(data.choices[0].message.content.trim())
  if (Number.isNaN(score) || score < -1 || score > 1) {
    throw new Error('Invalid score from OpenRouter')
  }
  return score
}

/** Score a single message (in-memory). */
export async function scoreSentiment(
  text: string,
): Promise<{ score: number; method: 'openrouter' | 'algorithmic' }> {
  if (!process.env.OPENROUTER_API_KEY) {
    return { score: scoreAlgorithmic(text), method: 'algorithmic' }
  }

  try {
    const score = await scoreWithOpenRouter(text)
    return { score, method: 'openrouter' }
  } catch (err) {
    console.warn('OpenRouter failed, using algorithmic fallback:', err)
    return { score: scoreAlgorithmic(text), method: 'algorithmic' }
  }
}

const OPENROUTER_SAMPLE_CAP = 5

/**
 * Attach sentiment scores to team channel messages for aggregate signal math.
 * Text is processed in memory and discarded after scoring.
 */
export async function scoreTeamMessagesSentiment(
  events: Array<{ text: string; timestamp: string; channel: string }>,
  options?: { useOpenRouter?: boolean; sampleSize?: number },
): Promise<
  Array<{ text: string; timestamp: string; channel: string; sentimentScore: number }>
> {
  const useOpenRouter = options?.useOpenRouter ?? Boolean(process.env.OPENROUTER_API_KEY)
  const sampleSize = Math.min(
    options?.sampleSize ?? OPENROUTER_SAMPLE_CAP,
    OPENROUTER_SAMPLE_CAP,
    events.length,
  )

  const scored = events.map((event) => ({
    ...event,
    sentimentScore: scoreAlgorithmic(event.text),
  }))

  if (!useOpenRouter || sampleSize === 0) {
    return scored
  }

  let usedOpenRouter = false
  for (let i = 0; i < sampleSize; i++) {
    const { score, method } = await scoreSentiment(scored[i].text)
    scored[i].sentimentScore = score
    if (method === 'openrouter') usedOpenRouter = true
  }

  if (!usedOpenRouter) {
    return scored
  }

  return scored
}
