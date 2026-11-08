import React from 'react';
import {
  Key,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  AlertCircle,
  FileText,
  Lock,
  Zap
} from 'lucide-react';

export const SetupGuide: React.FC = () => {
  const steps = [
    {
      num: '01',
      title: 'Sign in with your Google Account',
      desc: 'Navigate to aistudio.google.com and sign in with any standard Google Account (Gmail or Google Workspace). No Google Cloud billing account or credit card is required to access the free tier.',
      badge: 'Zero Cost',
    },
    {
      num: '02',
      title: 'Accept AI Studio Free Tier Terms',
      desc: 'Confirm the developer terms of service. On the free tier, prompts and responses may be processed and reviewed to improve Google AI products and services.',
      badge: 'Immediate Access',
    },
    {
      num: '03',
      title: 'Generate Free Tier API Key',
      desc: 'Click "Get API Key" in the sidebar, select "Create API Key in new project", and copy your secret string. It is instantly active with 15 RPM and 1,000,000 TPM quota.',
      badge: '15 RPM / 1M TPM',
    },
    {
      num: '04',
      title: 'Set GEMINI_API_KEY in Environment',
      desc: 'Store your key in your server environment variables as GEMINI_API_KEY. In AI Studio Build, this key is automatically connected to your backend server process.',
      badge: 'Server-Side Only',
    },
  ];

  const faqs = [
    {
      q: 'Do I need a credit card or billing account for the Gemini API free tier?',
      a: 'No. The Google AI Studio free tier requires only a standard Google account. You do not need to attach a credit card, enter payment details, or create a paid Google Cloud billing account.',
    },
    {
      q: 'What happens if I exceed 15 Requests Per Minute (RPM)?',
      a: 'The Gemini API returns an HTTP 429 RESOURCE_EXHAUSTED error status. Your application should implement an exponential backoff retry mechanism (e.g., pause 4 to 10 seconds before retrying). The quota refreshes every rolling 60 seconds.',
    },
    {
      q: 'Which models are available on the Free Tier?',
      a: 'Gemini 3.8 Flash (the primary multimodal and reasoning model) and Gemini 3.1 Flash Lite (ultra-low latency) are fully available on the free tier. Frontier heavy models like Gemini 4 Argon and specialized image/video models require a paid billing tier.',
    },
    {
      q: 'How does data privacy work on the Google Account Free Tier?',
      a: 'Under the Google AI Studio free tier terms of service, prompt inputs and model outputs may be reviewed by trained human reviewers and used to train and improve Google products. If your app handles proprietary enterprise or sensitive data, you can attach Google Cloud billing to activate the paid tier, which strictly disables model training on your data.',
    },
    {
      q: 'Where do I find my API key in this AI Studio environment?',
      a: 'In this Google AI Studio Build workspace, your Google account API key is automatically injected by the system into process.env.GEMINI_API_KEY. You never need to enter it into a browser form or hardcode it.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>Google Account Only</span>
              <span aria-hidden="true">·</span>
              <span>No Credit Card</span>
              <span aria-hidden="true">·</span>
              <span>15 RPM Limit</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Google AI Studio Free Tier Onboarding
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
              Complete setup guide for developers using the Gemini API free tier with a standard Google account.
            </p>
          </div>

          <a
            href="https://aistudio.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <span>Open Google AI Studio</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* 4 Steps Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {steps.map((s) => (
          <div
            key={s.num}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                  {s.num}
                </span>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                  {s.badge}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">
                {s.title}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {s.desc}
              </p>
            </div>

            <div className="pt-4 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Verified Step</span>
            </div>
          </div>
        ))}
      </div>

      {/* Local Machine & CLI Authentication Guide */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-500" />
              Local Machine & CLI Authentication (`gcloud` vs `GEMINI_API_KEY`)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Reference guide for running this application on your local workstation or terminal.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
            Local Dev Only
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Method A: Google AI Studio API Key (Recommended) */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Method A: Google AI Studio Key (Default)
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                Recommended
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Used by this app and the <code className="text-blue-500 font-mono">@google/genai</code> SDK. No gcloud CLI or Google Cloud billing required.
            </p>
            <div className="p-3 bg-slate-900 text-slate-200 rounded-lg font-mono text-xs overflow-x-auto space-y-1">
              <div className="text-slate-400 text-[11px]"># Export in your terminal or .env file:</div>
              <div className="text-emerald-400">export GEMINI_API_KEY="your-api-key"</div>
              <div className="text-slate-400 text-[11px] pt-1"># Start development server:</div>
              <div className="text-blue-300">npm run dev</div>
            </div>
          </div>

          {/* Method B: Google Cloud CLI & ADC (Vertex AI) */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Method B: Google Cloud CLI & ADC
              </span>
              <span className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                For Vertex AI / GCP
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Used when targeting Google Cloud Vertex AI infrastructure or GCP services on your local machine.
            </p>
            <div className="p-3 bg-slate-900 text-slate-200 rounded-lg font-mono text-xs overflow-x-auto space-y-1">
              <div className="text-slate-400 text-[11px]"># Check logged in accounts:</div>
              <div className="text-blue-300">gcloud auth list</div>
              <div className="text-slate-400 text-[11px] pt-1"># Login for gcloud CLI tool:</div>
              <div className="text-blue-300">gcloud auth login</div>
              <div className="text-slate-400 text-[11px] pt-1"># Setup Application Default Credentials (ADC):</div>
              <div className="text-amber-400">gcloud auth application-default login</div>
              <div className="text-slate-400 text-[11px] pt-1"># Create & set project:</div>
              <div className="text-emerald-400">gcloud projects create auto-service-rag-prod --name="Auto Service RAG"</div>
              <div className="text-emerald-400">gcloud config set project auto-service-rag-prod</div>
              <div className="text-slate-400 text-[11px] pt-1"># Enable production APIs:</div>
              <div className="text-cyan-300 text-[10px] leading-tight">
                gcloud services enable aiplatform.googleapis.com bigquery.googleapis.com \<br />
                &nbsp;&nbsp;storage.googleapis.com run.googleapis.com artifactregistry.googleapis.com \<br />
                &nbsp;&nbsp;cloudbuild.googleapis.com secretmanager.googleapis.com \<br />
                &nbsp;&nbsp;logging.googleapis.com cloudtrace.googleapis.com
              </div>
              <div className="text-slate-400 text-[11px] pt-1"># Region, Bucket & BigQuery Dataset:</div>
              <div className="text-emerald-400 text-[10px] leading-tight">
                gcloud config set compute/region us-central1<br />
                gcloud storage buckets create gs://PROJECT_ID-manuals --location=us-central1 --uniform-bucket-level-access<br />
                bq --location=US mk --dataset PROJECT_ID:auto_service
              </div>
              <div className="text-slate-400 text-[11px] pt-1"># Least-Privilege API Runtime Service Account:</div>
              <div className="text-amber-300 text-[10px] leading-tight font-mono">
                gcloud iam service-accounts create api-runtime --display-name="API runtime"<br />
                for R in roles/aiplatform.user roles/bigquery.dataViewer roles/bigquery.jobUser roles/storage.objectViewer; do<br />
                &nbsp;&nbsp;gcloud projects add-iam-policy-binding PROJECT_ID --member="serviceAccount:api-runtime@PROJECT_ID.iam.gserviceaccount.com" --role=$R<br />
                done
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900/60 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <span>
            <strong>In this AI Studio preview container</strong>, authentication is already provisioned automatically. You do not need to run <code className="font-mono text-blue-600 dark:text-blue-400">gcloud auth</code> commands inside this environment—your key and Firestore database are already active and connected.
          </span>
        </div>
      </div>

      {/* FAQs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">
          Frequently Asked Questions
        </h2>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {faqs.map((faq, i) => (
            <div key={i} className="py-4 first:pt-0 last:pb-0">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-1.5 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <span>{faq.q}</span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 pl-6 leading-relaxed">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
