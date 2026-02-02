import React, { useState, useEffect, useCallback } from 'react';
import { fetchWaterHistory, fetchLatestRecord, saveWaterRecord } from './services/supabaseClient';
import { fetchRawTextFromUrl } from './services/protalkService';
import { parseWaterData } from './services/geminiService';
import { WaterRecord, Trend } from './types';
import WaterChart from './components/WaterChart';
import StatCard from './components/StatCard';

const App: React.FC = () => {
  const [history, setHistory] = useState<WaterRecord[]>([]);
  const [latest, setLatest] = useState<WaterRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const historyData = await fetchWaterHistory();
      setHistory(historyData);
      
      const latestRecord = await fetchLatestRecord();
      setLatest(latestRecord);

      // Check if we need to auto-update (if last record is > 24 hours old)
      if (latestRecord && latestRecord.created_at) {
        const lastUpdate = new Date(latestRecord.created_at).getTime();
        const now = new Date().getTime();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        
        if (now - lastUpdate > twentyFourHours) {
           console.log("Data stale (>24h), triggering auto-update...");
           // We call handleUpdateData but without waiting to not block UI
           handleUpdateData();
        }
      } else if (!latestRecord) {
        // No data at all, initial fetch
        console.log("No data found, performing initial fetch...");
        handleUpdateData();
      }

    } catch (err: any) {
      setError(err.message || 'Failed to load history');
    } finally {
      setIsLoading(false);
    }
  }, []); // Empty dependency array as it only uses imports

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Main logic to fetch new data from ProTalk -> Gemini -> Supabase
  const handleUpdateData = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    setError(null);

    try {
      // 1. Get Text via ProTalk
      console.log('Fetching raw text from ProTalk...');
      const rawText = await fetchRawTextFromUrl();

      // 2. Parse Text via Gemini
      console.log('Parsing text with Gemini...');
      const extracted = await parseWaterData(rawText);

      // 3. Calculate Trend
      let trend: Trend = Trend.STABLE;
      if (extracted.change_24h > 0) trend = Trend.RISING;
      else if (extracted.change_24h < 0) trend = Trend.FALLING;

      const newRecord: WaterRecord = {
        water_level: extracted.water_level,
        change_24h: extracted.change_24h,
        trend: trend,
        // created_at is handled by Supabase default usually, but we can pass current time
        // However, Supabase insert usually ignores it if not strictly typed, 
        // relying on the DB default is safer. 
      };

      // 4. Save to Supabase
      console.log('Saving to Supabase...', newRecord);
      await saveWaterRecord(newRecord);

      // 5. Refresh UI
      await loadData();

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update water data');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-water-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            </svg>
            <h1 className="text-xl font-bold text-slate-800">Shebsh Monitor</h1>
          </div>
          
          <button 
            onClick={handleUpdateData}
            disabled={isUpdating}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              isUpdating 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                : 'bg-water-600 text-white hover:bg-water-700 shadow-sm hover:shadow'
            }`}
          >
            {isUpdating ? (
              <>
                <svg className="animate-spin h-4 w-4 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Update Now
              </>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-2">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
             <span>{error}</span>
          </div>
        )}

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard 
              title="Current Water Level" 
              value={latest ? `${latest.water_level} cm` : '--'} 
              subtext={latest?.created_at ? `Last updated: ${new Date(latest.created_at).toLocaleDateString()}` : 'No data'}
              color="text-water-600"
            />
            <StatCard 
              title="24h Change" 
              value={latest ? `${Math.abs(latest.change_24h)} cm` : '--'} 
              trend={latest ? (latest.change_24h > 0 ? 'up' : latest.change_24h < 0 ? 'down' : 'neutral') : 'neutral'}
              subtext={latest ? (latest.change_24h > 0 ? 'Rising' : latest.change_24h < 0 ? 'Falling' : 'Stable') : undefined}
            />
            <StatCard 
              title="Trend" 
              value={latest ? latest.trend : '--'}
              color={latest?.trend === Trend.RISING ? 'text-red-600' : latest?.trend === Trend.FALLING ? 'text-emerald-600' : 'text-slate-600'}
              subtext="Analysis based on 24h delta"
            />
        </div>

        {/* Chart Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800">Trend Visualization</h2>
          </div>
          {isLoading && history.length === 0 ? (
             <div className="h-[400px] w-full bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center">
                <span className="text-slate-400 flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading history...
                </span>
             </div>
          ) : (
            <WaterChart data={history} />
          )}
        </div>

        <div className="text-center text-sm text-slate-400">
           Data source: {latest ? 'ProTalk / AllRivers.info' : 'Waiting for connection...'}
        </div>
      </main>
    </div>
  );
};

export default App;
