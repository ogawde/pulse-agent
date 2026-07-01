import 'dotenv/config'

import { extractMetadataFromRtsMessages } from '../rts/metadata.js'
import { scoreTeamFromMetadata } from './metadata.js'

const now = Date.now() / 1000
const weekAgo = now - 3 * 86400
const twoWeeksAgo = now - 10 * 86400

const demoRtsHits = [
  { message_ts: String(now - 3600), channel_id: 'C_ENGINEERING' },
  { message_ts: String(now - 7200), channel_id: 'C_ENGINEERING' },
  { message_ts: String(now - 90000), channel_id: 'C_ENGINEERING' },
  { message_ts: String(weekAgo), channel_id: 'C_ENGINEERING' },
  { message_ts: String(twoWeeksAgo), channel_id: 'C_ENGINEERING' },
  { message_ts: String(twoWeeksAgo - 3600), channel_id: 'C_ENG_OPS' },
]

const metadata = extractMetadataFromRtsMessages(demoRtsHits)
const result = scoreTeamFromMetadata(metadata, {
  baselineChannelIds: ['C_ENGINEERING', 'C_ENG_OPS'],
})

console.log('Team metadata scoring (no message text):')
console.log(JSON.stringify({ metadata: { totalMessages: metadata.totalMessages, afterHoursCount: metadata.afterHoursCount }, result }, null, 2))
