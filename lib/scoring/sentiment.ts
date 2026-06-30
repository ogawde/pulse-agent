import { getAppUrl } from '@/lib/utils'

async function scoreWithOpenRouter(text: string): Promise<number> {
  const model = process.env.OPENROUTER_MODEL ?? 'openrouter/auto'

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': getAppUrl(),
      'X-Title': 'Ember Risk Monitor',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a workplace sentiment analyzer. Score the sentiment of the following workplace message on a scale from -1.0 (extremely hostile or negative) to 1.0 (very positive and supportive). Consider professional context. Return ONLY a decimal number between -1.0 and 1.0. No explanation. No other text.',
        },
        { role: 'user', content: text },
      ],
      max_tokens: 10,
      temperature: 0,
    }),
  })

  if (!response.ok) throw new Error(`OpenRouter error: ${response.status}`)

  const data = await response.json()
  const score = parseFloat(data.choices[0].message.content.trim())
  if (isNaN(score) || score < -1 || score > 1) throw new Error('Invalid score from OpenRouter')
  return score
}

function scoreAlgorithmic(text: string): number {
  const lower = text.toLowerCase()
  const negativeWords = [
    'stupid',
    'idiot',
    'useless',
    'incompetent',
    'worst',
    'hate',
    'terrible',
    'awful',
    'wrong',
    'never',
    'failed',
    'failure',
    'lazy',
    'pathetic',
    'ridiculous',
    'unacceptable',
    'disappointed',
    'embarrassing',
    'waste',
    'pointless',
  ]
  const positiveWords = [
    'great',
    'excellent',
    'good',
    'well done',
    'fantastic',
    'thanks',
    'appreciate',
    'helpful',
    'amazing',
    'brilliant',
    'nice work',
    'perfect',
    'impressive',
    'love',
    'wonderful',
    'outstanding',
    'superb',
  ]
  const afterHoursPattern = /urgent|asap|immediately|need this now|right now|can you just|why haven't you/i

  let score = 0
  negativeWords.forEach((w) => {
    if (lower.includes(w)) score -= 0.2
  })
  positiveWords.forEach((w) => {
    if (lower.includes(w)) score += 0.15
  })
  if (afterHoursPattern.test(text)) score -= 0.1

  return Math.max(-1, Math.min(1, score))
}

export async function scoreSentiment(
  text: string
): Promise<{ score: number; method: 'openrouter' | 'algorithmic' }> {
  try {
    const score = await scoreWithOpenRouter(text)
    return { score, method: 'openrouter' }
  } catch (err) {
    console.warn('OpenRouter failed, using algorithmic fallback:', err)
    return { score: scoreAlgorithmic(text), method: 'algorithmic' }
  }
}
