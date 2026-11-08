export interface FreeTierModel {
  id: string;
  name: string;
  badge?: string;
  tagline: string;
  contextWindow: string;
  freeRpm: number;
  freeTpm: number;
  freeRpd: number;
  supportsThinking: boolean;
  supportsVision: boolean;
  costPerMillionFree: string;
  bestFor: string;
}

export interface PaidTierModel {
  id: string;
  name: string;
  badge: string;
  contextWindow: string;
  freeTierAvailable: boolean;
  requiresPaidKey: boolean;
  description: string;
}

export interface ApiStatus {
  status: string;
  hasApiKey: boolean;
  accountTier: string;
  freeTierModels: FreeTierModel[];
  paidTierComparison: PaidTierModel[];
  quotas: {
    rpm: number;
    tpm: number;
    rpd: number;
    creditCardRequired: boolean;
    privacyPolicy: string;
  };
}

export interface UsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

export interface GenerateResponse {
  text: string;
  elapsedMs: number;
  usageMetadata?: UsageMetadata;
  model: string;
  responseFormat: string;
  thinkingLevel?: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  elapsedMs?: number;
  tokens?: number;
}

export interface QuotaState {
  requestsThisMinute: number;
  tokensThisMinute: number;
  requestsToday: number;
  lastRequestTime: number;
}
