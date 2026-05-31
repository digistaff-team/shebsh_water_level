export interface LaunchStats {
  day: number;
  week: number;
  month: number;
  total: number;
}

const SESSION_FLAG = 'app_launch_tracked';

const fetchStats = async (method: 'GET' | 'POST'): Promise<LaunchStats | null> => {
  try {
    const res = await fetch('/api/launches', { method, cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (
      data &&
      typeof data.day === 'number' &&
      typeof data.week === 'number' &&
      typeof data.month === 'number' &&
      typeof data.total === 'number'
    ) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
};

// Records this session as a launch (once per session) and returns the latest stats.
export const trackLaunchAndGetStats = async (): Promise<LaunchStats | null> => {
  try {
    if (sessionStorage.getItem(SESSION_FLAG)) {
      return fetchStats('GET');
    }
    sessionStorage.setItem(SESSION_FLAG, '1');
  } catch {
    // sessionStorage unavailable (rare): just track anyway.
  }
  return fetchStats('POST');
};
