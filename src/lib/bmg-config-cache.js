import { getConfigData } from "@/lib/bemyguest";

const DAY_MS = 24 * 60 * 60 * 1000;

const state = {
  data: null,
  lastRefreshedAt: null,
  lastAttemptAt: null,
  lastError: "",
};

function isFresh() {
  if (!state.lastRefreshedAt) return false;
  return Date.now() - state.lastRefreshedAt < DAY_MS;
}

export async function refreshConfigCache() {
  state.lastAttemptAt = Date.now();
  const payload = await getConfigData();
  state.data = payload;
  state.lastRefreshedAt = Date.now();
  state.lastError = "";
  return payload;
}

export async function getConfigSnapshot({ forceRefresh = false } = {}) {
  if (forceRefresh || !isFresh()) {
    try {
      await refreshConfigCache();
    } catch (error) {
      state.lastError = error instanceof Error ? error.message : "Unknown API error.";
    }
  }

  return {
    hasData: Boolean(state.data),
    isFresh: isFresh(),
    ttlHours: 24,
    lastRefreshedAt: state.lastRefreshedAt
      ? new Date(state.lastRefreshedAt).toISOString()
      : "",
    lastAttemptAt: state.lastAttemptAt
      ? new Date(state.lastAttemptAt).toISOString()
      : "",
    lastError: state.lastError,
  };
}
