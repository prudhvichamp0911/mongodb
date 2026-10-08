require('dotenv').config();
const { getContactsCollection } = require('./db');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';
const MAX_RESULTS = 100;

const SCHEMA_DESCRIPTION = `
MongoDB collection "contacts" (database: contactsdb). Each document has these fields:
- firstName (string|null): contact's first name (split from full name)
- lastName (string|null): contact's last name
- email (string|null): email address
- phone (string|null): phone number (null for all rows in this dataset)
- company (string|null): company name (null for all rows in this dataset)
- title (string): job title / decision-maker title (e.g. "Chief Executive Officer")
- industry (string|null): industry sector (e.g. "Hospitality", "Financial Services")
- country (string|null): country (e.g. "United States", "India")
`.trim();

const QUERY_SYSTEM_PROMPT = `You are a MongoDB query generator. ${SCHEMA_DESCRIPTION}

Convert the user's natural-language question into a MongoDB read query.
Respond with ONLY a JSON object (no markdown, no explanation) in exactly one of these shapes:

1) Simple lookup / filter:
{"operation":"find","filter":{...},"limit":<number 1-100>}

2) Count:
{"operation":"count","filter":{...}}

3) Aggregation (grouping, stats, top-N):
{"operation":"aggregate","pipeline":[...]}

Rules:
- String matching should be case-insensitive: use {"$regex":"value","$options":"i"} where appropriate.
- NEVER use write operations. Forbidden operators: $out, $merge, $where, $function.
- Use only the fields listed above.
- For "how many" questions use count or aggregate.
- For "list/show/find" questions use find with a sensible limit (default 20).
- If the question cannot be answered from these fields, respond: {"operation":"none","reason":"short explanation"}`;

const ANSWER_SYSTEM_PROMPT = `You are a helpful data assistant. ${SCHEMA_DESCRIPTION}

You will be given the user's question, the MongoDB query that was run, and the raw results.
Write a concise natural-language answer. Mention counts/numbers when relevant.
If results are empty, say so plainly. Do not invent data that is not in the results.`;

async function callLLM(messages, { json = false } = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey.startsWith('paste-')) {
    throw new Error('OPENROUTER_API_KEY is not set in .env');
  }

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

function extractJson(text) {
  // Strip markdown fences if the model added them despite instructions
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('LLM did not return JSON');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function sanitizeFilter(filter) {
  if (filter === undefined || filter === null) return {};
  if (typeof filter !== 'object' || Array.isArray(filter)) {
    throw new Error('Invalid filter from LLM');
  }
  const json = JSON.stringify(filter);
  const forbidden = ['$where', '$function', '$accumulator'];
  for (const f of forbidden) {
    if (json.includes(f)) throw new Error(`Forbidden operator in filter: ${f}`);
  }
  return filter;
}

function sanitizePipeline(pipeline) {
  if (!Array.isArray(pipeline)) throw new Error('Invalid pipeline from LLM');
  const json = JSON.stringify(pipeline);
  const forbidden = ['$out', '$merge', '$where', '$function', '$accumulator'];
  for (const f of forbidden) {
    if (json.includes(f)) throw new Error(`Forbidden stage/operator in pipeline: ${f}`);
  }
  return pipeline;
}

async function executeQuery(querySpec) {
  const contacts = getContactsCollection();

  switch (querySpec.operation) {
    case 'find': {
      const filter = sanitizeFilter(querySpec.filter);
      const limit = Math.min(Math.max(parseInt(querySpec.limit, 10) || 20, 1), MAX_RESULTS);
      const results = await contacts.find(filter).limit(limit).toArray();
      return { mongoQuery: { operation: 'find', filter, limit }, results };
    }
    case 'count': {
      const filter = sanitizeFilter(querySpec.filter);
      const count = await contacts.countDocuments(filter);
      return { mongoQuery: { operation: 'count', filter }, results: [{ count }] };
    }
    case 'aggregate': {
      const pipeline = sanitizePipeline(querySpec.pipeline);
      const results = await contacts.aggregate(pipeline).limit(MAX_RESULTS).toArray();
      return { mongoQuery: { operation: 'aggregate', pipeline }, results };
    }
    case 'none':
      return { mongoQuery: null, results: [], reason: querySpec.reason };
    default:
      throw new Error(`Unknown operation: ${querySpec.operation}`);
  }
}

async function answerQuestion(question) {
  // Step 1: question -> MongoDB query spec
  const queryText = await callLLM(
    [
      { role: 'system', content: QUERY_SYSTEM_PROMPT },
      { role: 'user', content: question },
    ],
    { json: true }
  );

  const querySpec = extractJson(queryText);

  // Step 2: validate + execute (read-only)
  const { mongoQuery, results, reason } = await executeQuery(querySpec);

  // Step 3: results -> natural-language answer
  const answer = await callLLM([
    { role: 'system', content: ANSWER_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Question: ${question}\n\nQuery run: ${JSON.stringify(mongoQuery)}\n\nResults (${results.length} rows, capped at ${MAX_RESULTS}):\n${JSON.stringify(results.slice(0, 50))}\n\n${reason ? `Note: ${reason}` : ''}`,
    },
  ]);

  return { answer, mongoQuery, results: results.slice(0, MAX_RESULTS) };
}

module.exports = { answerQuestion };
