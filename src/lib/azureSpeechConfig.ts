const AZURE_SPEECH_KEY = "azure_speech_key";
const AZURE_SPEECH_REGION = "azure_speech_region";

export interface AzureSpeechConfig {
  key: string;
  region: string;
}

export function getAzureSpeechConfig(): AzureSpeechConfig | null {
  if (typeof window === "undefined") return null;
  const key = localStorage.getItem(AZURE_SPEECH_KEY);
  const region = localStorage.getItem(AZURE_SPEECH_REGION);
  if (!key || !region) return null;
  return { key, region };
}

export function setAzureSpeechConfig(config: AzureSpeechConfig) {
  localStorage.setItem(AZURE_SPEECH_KEY, config.key);
  localStorage.setItem(AZURE_SPEECH_REGION, config.region);
}

export function removeAzureSpeechConfig() {
  localStorage.removeItem(AZURE_SPEECH_KEY);
  localStorage.removeItem(AZURE_SPEECH_REGION);
}
