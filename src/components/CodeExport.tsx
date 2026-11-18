import React, { useState } from 'react';
import { Copy, Check, Terminal, Code, FileText, CheckCircle2, Edit3, Trash2, RotateCcw } from 'lucide-react';

interface CodeExportProps {
  model: string;
  systemInstruction: string;
  thinkingLevel: string;
  prompt: string;
  responseFormat: string;
}

export const CodeExport: React.FC<CodeExportProps> = ({
  model,
  systemInstruction,
  thinkingLevel,
  prompt,
  responseFormat,
}) => {
  const [language, setLanguage] = useState<'typescript' | 'python' | 'adk-python' | 'curl' | 'rest' | 'bigquery-rag'>('typescript');
  const [pythonClientType, setPythonClientType] = useState<'vertex_ai' | 'api_key'>('vertex_ai');
  const [copied, setCopied] = useState(false);
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [customCodeMap, setCustomCodeMap] = useState<Record<string, string>>({});
  const [editedText, setEditedText] = useState('');

  const cleanPrompt = prompt || 'Explain quantum computing in one sentence.';

  const generateTsSnippet = () => {
    let thinkingPart = '';
    if (model === 'gemini-3.8-flash' && thinkingLevel) {
      thinkingPart = `,\n    thinkingConfig: { thinkingLevel: ThinkingLevel.${thinkingLevel} }`;
    }

    let sysPart = '';
    if (systemInstruction) {
      sysPart = `,\n    systemInstruction: ${JSON.stringify(systemInstruction)}`;
    }

    let jsonPart = '';
    if (responseFormat === 'json') {
      jsonPart = `,\n    responseMimeType: "application/json"`;
    }

    const hasConfig = thinkingPart || sysPart || jsonPart;

    return `import { GoogleGenAI${model === 'gemini-3.8-flash' ? ', ThinkingLevel' : ''} } from "@google/genai";

// Initialize Gemini client (process.env.GEMINI_API_KEY from Google AI Studio free tier)
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function main() {
  const response = await ai.models.generateContent({
    model: "${model}",
    contents: ${JSON.stringify(cleanPrompt)}${hasConfig ? `,\n    config: {${sysPart.replace(/^,\n/, '')}${thinkingPart}${jsonPart}\n    }` : ''}
  });

  console.log(response.text);
}

main().catch(console.error);`;
  };

  const generatePythonSnippet = () => {
    let configArgs = [];
    if (systemInstruction) {
      configArgs.push(`        system_instruction=${JSON.stringify(systemInstruction)}`);
    }
    if (responseFormat === 'json') {
      configArgs.push(`        response_mime_type="application/json"`);
    }
    if (model === 'gemini-3.8-flash' && thinkingLevel) {
      configArgs.push(`        thinking_config={"thinking_level": "${thinkingLevel.toLowerCase()}"}`);
    }

    const configBlock = configArgs.length > 0
      ? `,\n    config=types.GenerateContentConfig(\n${configArgs.join(',\n')}\n    )`
      : '';

    if (pythonClientType === 'vertex_ai') {
      return `import os
from google import genai
from google.genai import types

# Modern Google GenAI SDK (pip install google-genai)
# Authenticated via Google Cloud ADC (gcloud auth application-default login)
project_id = os.environ.get("GOOGLE_CLOUD_PROJECT", "PROJECT_ID")
location = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")

client = genai.Client(vertexai=True, project=project_id, location=location)

response = client.models.generate_content(
    model="${model}",
    contents=${JSON.stringify(cleanPrompt)}${configBlock}
)

print(response.text)
if response.usage_metadata:
    print(f"Total tokens used: {response.usage_metadata.total_token_count}")`;
    }

    return `import os
from google import genai
from google.genai import types

# Modern Google GenAI SDK (pip install google-genai)
# Free Tier via Google AI Studio API Key:
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

response = client.models.generate_content(
    model="${model}",
    contents=${JSON.stringify(cleanPrompt)}${configBlock}
)

print(response.text)`;
  };

  const generateCurlSnippet = () => {
    const payload: any = {
      contents: [{ parts: [{ text: cleanPrompt }] }],
    };
    if (systemInstruction) {
      payload.systemInstruction = { parts: [{ text: systemInstruction }] };
    }
    if (responseFormat === 'json') {
      payload.generationConfig = { responseMimeType: 'application/json' };
    }

    return `curl "https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=\${GEMINI_API_KEY}" \\
  -H "Content-Type: application/json" \\
  -X POST \\
  -d '${JSON.stringify(payload, null, 2)}'`;
  };

  const generateRestSnippet = () => {
    return `const apiKey = process.env.GEMINI_API_KEY;
const url = \`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=\${apiKey}\`;

const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    contents: [{ parts: [{ text: ${JSON.stringify(cleanPrompt)} }] }]
  })
});

const data = await response.json();
console.log(data.candidates?.[0]?.content?.parts?.[0]?.text);`;
  };

  const generateBigQuerySnippet = () => {
    return `-- 1. Establish Remote Connection to Vertex AI Embedding Endpoint
CREATE OR REPLACE MODEL \`PROJECT_ID.auto_service.embedding_model\`
REMOTE WITH CONNECTION \`us-central1.vertex-ai\`
OPTIONS (ENDPOINT = 'text-embedding-005');

-- 2. Create the Automotive Workshop Manual Chunks Table
-- Populated from Cloud Storage bucket: gs://PROJECT_ID-manuals
CREATE OR REPLACE TABLE \`PROJECT_ID.auto_service.manual_chunks\` (
  chunk_id STRING NOT NULL,
  vehicle_make STRING NOT NULL,
  vehicle_model STRING NOT NULL,
  year_range STRING,
  system STRING,
  title STRING,
  section_code STRING,
  content STRING,
  dtc_codes ARRAY<STRING>,
  torque_specs JSON,
  gcs_source_uri STRING,
  embedding ARRAY<FLOAT64>
);

-- 3. Ingest Manual Documents & Generate Embeddings
UPDATE \`PROJECT_ID.auto_service.manual_chunks\` target
SET target.embedding = src.ml_generate_embedding_result
FROM (
  SELECT chunk_id, ml_generate_embedding_result
  FROM ML.GENERATE_EMBEDDING(
    MODEL \`PROJECT_ID.auto_service.embedding_model\`,
    TABLE \`PROJECT_ID.auto_service.manual_chunks\`
  )
) src
WHERE target.chunk_id = src.chunk_id;

-- 4. Execute Vector Search for Diagnostic Trouble Code (DTC)
SELECT
  base.chunk_id,
  base.vehicle_make,
  base.vehicle_model,
  base.section_code,
  base.title,
  base.torque_specs,
  base.content,
  distance
FROM VECTOR_SEARCH(
  TABLE \`PROJECT_ID.auto_service.manual_chunks\`, 'embedding',
  (
    SELECT ml_generate_embedding_result AS embedding
    FROM ML.GENERATE_EMBEDDING(
      MODEL \`PROJECT_ID.auto_service.embedding_model\`,
      (SELECT 'Ford F-150 EcoBoost P0300 cylinder misfire ignition coil test' AS content)
    )
  ),
  top_k => 3,
  distance_type => 'COSINE'
)
ORDER BY distance ASC;`;
  };

  const generateAdkPythonSnippet = () => {
    return `"""
Google Agent Development Kit (ADK) Multi-Agent Automotive Triage
Run interactive playground: agents-cli playground  OR  uv run adk web
A2A Agent Card endpoint:   GET /.well-known/agent-card.json
"""
import asyncio
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

# Uses root_agent & App defined in app/agent.py
from app.agent import app, root_agent


async def run_adk_triage():
    session_service = InMemorySessionService()
    session = await session_service.create_session(
        app_name=app.name,
        user_id="service_advisor_01",
    )

    runner = Runner(
        agent=root_agent,
        app_name=app.name,
        session_service=session_service,
    )

    prompt = ${JSON.stringify(cleanPrompt)}
    content = types.Content(role="user", parts=[types.Part.from_text(text=prompt)])

    async for event in runner.run_async(
        user_id="service_advisor_01",
        session_id=session.id,
        new_message=content,
    ):
        if event.is_final_response() and event.content:
            print("".join(p.text for p in event.content.parts if p.text))


if __name__ == "__main__":
    asyncio.run(run_adk_triage())`;
  };

  const getCode = () => {
    switch (language) {
      case 'typescript':
        return generateTsSnippet();
      case 'python':
        return generatePythonSnippet();
      case 'adk-python':
        return generateAdkPythonSnippet();
      case 'curl':
        return generateCurlSnippet();
      case 'rest':
        return generateRestSnippet();
      case 'bigquery-rag':
        return generateBigQuerySnippet();
    }
  };

  const defaultCode = getCode();
  const currentCode = customCodeMap[language] !== undefined ? customCodeMap[language] : defaultCode;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartEdit = () => {
    setEditedText(currentCode);
    setIsEditingCode(true);
  };

  const handleSaveEdit = () => {
    setCustomCodeMap((prev) => ({ ...prev, [language]: editedText }));
    setIsEditingCode(false);
  };

  const handleDeleteCode = () => {
    setCustomCodeMap((prev) => ({ ...prev, [language]: '// Snippet cleared by user.\n' }));
    setIsEditingCode(false);
  };

  const handleResetDefault = () => {
    setCustomCodeMap((prev) => {
      const next = { ...prev };
      delete next[language];
      return next;
    });
    setIsEditingCode(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>SDK Code Generator</span>
              <span aria-hidden="true">·</span>
              <span>Modern @google/genai SDK & BigQuery Vector Search</span>
              <span aria-hidden="true">·</span>
              <span>Ready for Production</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Instant SDK & Cloud Code Export
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
              Copy fully working client code pre-populated with your chosen model ({model}), system instructions, thinking levels, or BigQuery Vector Search SQL DDL.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={isEditingCode ? handleSaveEdit : handleStartEdit}
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Edit code snippet"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditingCode ? 'Save Code' : 'Edit Snippet'}</span>
            </button>

            <button
              type="button"
              onClick={handleDeleteCode}
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Clear / Delete code snippet"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear / Delete</span>
            </button>

            {customCodeMap[language] !== undefined && (
              <button
                type="button"
                onClick={handleResetDefault}
                className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                title="Reset to generated default code"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2 cursor-pointer shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied Code' : 'Copy Snippet'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Code Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        {/* Language Tabs */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {(
              [
                { id: 'typescript', label: 'TypeScript (@google/genai)' },
                { id: 'python', label: 'Python (google-genai)' },
                { id: 'adk-python', label: 'Python (Google ADK)' },
                { id: 'bigquery-rag', label: 'BigQuery SQL (Vector RAG)' },
                { id: 'curl', label: 'cURL Command' },
                { id: 'rest', label: 'Fetch / REST' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setLanguage(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  language === tab.id
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-400 font-mono">
            {language === 'typescript'
              ? 'server.ts'
              : language === 'python'
                ? 'smoke_test.py'
                : language === 'adk-python'
                  ? 'app/agent.py'
                  : language === 'bigquery-rag'
                    ? 'schema.sql'
                    : 'terminal'}
          </span>
        </div>

        {/* Python Mode Selector (Vertex AI vs API Key) */}
        {language === 'python' && (
          <div className="flex items-center gap-3 px-5 py-2 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-xs">
            <span className="text-slate-500 font-medium">SDK Client Mode:</span>
            <button
              onClick={() => setPythonClientType('vertex_ai')}
              className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                pythonClientType === 'vertex_ai'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-blue-400'
              }`}
            >
              Vertex AI (vertexai=True, ADC)
            </button>
            <button
              onClick={() => setPythonClientType('api_key')}
              className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                pythonClientType === 'api_key'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-blue-400'
              }`}
            >
              Google AI Studio (api_key)
            </button>
          </div>
        )}

        {/* Code Block / Editor */}
        <div className="p-5 bg-slate-950 overflow-x-auto">
          {isEditingCode ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-blue-400">Editing Snippet ({language}):</span>
                <span className="text-[11px] font-mono">Changes persist for this session</span>
              </div>
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                rows={16}
                className="w-full p-3 font-mono text-xs bg-slate-900 border border-slate-700 rounded-lg text-emerald-400 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingCode(false)}
                  className="px-3 py-1.5 text-xs rounded bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Code Changes</span>
                </button>
              </div>
            </div>
          ) : (
            <pre className="text-xs font-mono text-slate-200 leading-relaxed">
              {currentCode}
            </pre>
          )}
        </div>

        {/* Note */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              All snippets use server-side execution with the latest Gemini 3.8 SDK standard.
            </span>
          </div>
          <span className="font-mono text-[11px] text-slate-400">
            Free Tier Quota: 15 RPM
          </span>
        </div>
      </div>
    </div>
  );
};
