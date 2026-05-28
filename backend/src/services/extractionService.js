// src/services/extractionService.js
import OpenAI from 'openai';

// TEST_MODE=1 substitutes the in-memory FakeOpenAI for the real client. Refuses in production.
const useTestFake = process.env.TEST_MODE === '1' && process.env.NODE_ENV !== 'production';
const FakeOpenAI = useTestFake ? (await import('../../tests/fakes/fakeOpenAI.js')).default : null;

const openai = useTestFake
  ? new FakeOpenAI()
  : new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `Extract time entry data from transcription. Return JSON:
{
  "action_type": "IN|OUT|HOURS|OFF",
  "worker": "full name or null",
  "worksite": "site name or null",
  "hours": number or null,
  "start_time": "HH:MM or null",
  "end_time": "HH:MM or null",
  "date": "YYYY-MM-DD or null (defaults to provided date)",
  "confidence": "high|medium|low",
  "additional_workers": ["name1", "name2"] or [],
  "notes": "any special circumstances or null"
}

Date handling:
- If worker says "yesterday", calculate yesterday's date from provided "today's date"
- If worker says "today" or no date mentioned, use provided date
- Always extract times if mentioned (e.g., "from 9AM to 4PM" -> start_time="09:00", end_time="16:00")

Confidence rules:
- high: Clear, complete information
- medium: Ambiguous or conflicting info, or multiple workers mentioned
- low: Missing critical info, garbled text, or vague references`;

export async function extractTimeCardData({ transcription, workerName, date }) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Transcription: "${transcription}"
Worker name: "${workerName}"
Today's date: "${date}"`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1
    });

    const extracted = JSON.parse(response.choices[0].message.content);

    // Ensure date defaults to provided date if not specified
    if (!extracted.date) {
      extracted.date = date;
    }

    return extracted;
  } catch (error) {
    console.error('Extraction failed:', error);
    throw new Error(`Failed to extract data: ${error.message}`);
  }
}
