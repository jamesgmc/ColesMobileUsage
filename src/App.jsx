import React, { useState, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { 
  UploadCloud, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  ChevronRight,
  BarChart2, 
  Calendar, 
  List,
  ArrowUpDown
} from 'lucide-react';

// --- Utility Functions ---
const parseDate = (dateStr) => new Date(dateStr);
const formatBytes = (kb) => {
  if (!kb) return '0 KB';
  const k = 1024;
  const sizes = ['KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(kb) / Math.log(k));
  return parseFloat((kb / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function App() {
  const [data, setData] = useState([]);
  const [viewMode, setViewMode] = useState('raw'); // 'raw', 'daily', 'monthly'
  const [searchTerm, setSearchTerm] = useState('');
  
  // Sorting state: { key: string, direction: 'asc' | 'desc' }
  const [sortConfig, setSortConfig] = useState({ key: 'Date', direction: 'desc' });
  const [expandedMonths, setExpandedMonths] = useState({});

  const onDrop = (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        
        // Skip first row (metadata)
        const lines = text.split('\n');
        const csvData = lines.slice(1).join('\n');
        
        Papa.parse(csvData, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const parsedData = results.data
              .filter(row => row.Date && row.Event) // basic validation
              .map(row => {
                const parts = row.Date.split('/');
                let displayDate = row.Date;
                let displayDay = '';
                if (parts.length === 3) {
                  const d = new Date(row.Date);
                  if (!isNaN(d)) {
                    displayDay = `(${d.toLocaleDateString('en-US', { weekday: 'short' })})`;
                  }
                  displayDate = `${parts[1]}/${parts[0]}/${parts[2]}`;
                }
                return {
                  Event: row.Event,
                  To: row.To,
                  Date: row.Date,
                  DisplayDate: displayDate,
                  DisplayDay: displayDay,
                  Time: row.Time,
                  Duration: parseInt(row['Duration (Sec)'] || '0', 10),
                  DataUp: parseFloat(row['Data Up (KB)'] || '0'),
                  DataDown: parseFloat(row['Data Down (KB)'] || '0'),
                  Price: row.Price || '$0'

                };
              });
            setData(parsedData);
          }
        });
      };
      reader.readAsText(file);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'text/csv': ['.csv'] } });

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const toggleMonthExpand = (monthKey) => {
    setExpandedMonths(prev => ({
      ...prev,
      [monthKey]: !prev[monthKey]
    }));
  };

  // --- Data Aggregation ---
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const lower = searchTerm.toLowerCase();
    return data.filter(row => 
      Object.values(row).some(val => String(val).toLowerCase().includes(lower))
    );
  }, [data, searchTerm]);

  const rawSorted = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      
      if (sortConfig.key === 'Date') {
        aVal = new Date(`${a.Date} ${a.Time}`).getTime();
        bVal = new Date(`${b.Date} ${b.Time}`).getTime();
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);

  const dailyData = useMemo(() => {
    const grouped = filteredData.reduce((acc, row) => {
      const d = row.Date;
      if (!acc[d]) {
        acc[d] = { Date: d, DisplayDate: row.DisplayDate, DisplayDay: row.DisplayDay, DataUp: 0, DataDown: 0, Duration: 0, Events: 0 };
      }
      acc[d].DataUp += row.DataUp;
      acc[d].DataDown += row.DataDown;
      acc[d].Duration += row.Duration;
      acc[d].Events += 1;
      return acc;
    }, {});
    
    const arr = Object.values(grouped).map(d => ({
      ...d,
      TotalData: d.DataUp + d.DataDown
    }));

    return arr.sort((a, b) => {
      let aVal = a[sortConfig.key] ?? a.Date;
      let bVal = b[sortConfig.key] ?? b.Date;
      
      if (sortConfig.key === 'Date' || sortConfig.key === 'Month') {
        aVal = new Date(a.Date).getTime();
        bVal = new Date(b.Date).getTime();
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);

  const monthlyData = useMemo(() => {
    const grouped = filteredData.reduce((acc, row) => {
      const d = new Date(row.Date);
      if (isNaN(d.getTime())) return acc;
      
      const monthKey = d.toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!acc[monthKey]) {
        acc[monthKey] = { 
          Month: monthKey, 
          MonthSort: new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
          DataUp: 0, 
          DataDown: 0, 
          Duration: 0, 
          Events: 0,
          Daily: {}
        };
      }
      
      acc[monthKey].DataUp += row.DataUp;
      acc[monthKey].DataDown += row.DataDown;
      acc[monthKey].Duration += row.Duration;
      acc[monthKey].Events += 1;

      // Group sub-daily
      if (!acc[monthKey].Daily[row.Date]) {
        acc[monthKey].Daily[row.Date] = { Date: row.Date, DisplayDate: row.DisplayDate, DisplayDay: row.DisplayDay, DataUp: 0, DataDown: 0, Duration: 0, Events: 0 };
      }
      acc[monthKey].Daily[row.Date].DataUp += row.DataUp;
      acc[monthKey].Daily[row.Date].DataDown += row.DataDown;
      acc[monthKey].Daily[row.Date].Duration += row.Duration;
      acc[monthKey].Daily[row.Date].Events += 1;

      return acc;
    }, {});

    const arr = Object.values(grouped).map(m => {
      const dailyArr = Object.values(m.Daily).map(d => ({
        ...d,
        TotalData: d.DataUp + d.DataDown
      })).sort((a,b) => new Date(a.Date) - new Date(b.Date));
      
      return {
        ...m,
        TotalData: m.DataUp + m.DataDown,
        DailyArr: dailyArr
      };
    });

    return arr.sort((a, b) => {
      let aVal = a[sortConfig.key] ?? a.MonthSort;
      let bVal = b[sortConfig.key] ?? b.MonthSort;
      
      if (sortConfig.key === 'Date' || sortConfig.key === 'Month') {
        aVal = a.MonthSort;
        bVal = b.MonthSort;
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);

  // --- Render Helpers ---
  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="w-4 h-4 text-zinc-500 inline ml-2" />;
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="w-4 h-4 text-zinc-50 inline ml-2" />
      : <ChevronDown className="w-4 h-4 text-zinc-50 inline ml-2" />;
  };

  const Th = ({ label, sortKey, className = "" }) => (
    <th 
      onClick={() => handleSort(sortKey)}
      className={`px-4 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-zinc-800 transition-colors ${className}`}
    >
      <div className="flex items-center">
        {label} <SortIcon column={sortKey} />
      </div>
    </th>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-indigo-500/30">
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              Mobile Data Analyzer
            </h1>
            <p className="text-zinc-400 mt-1">High-performance CSV log parser</p>
          </div>
          
          {data.length > 0 && (
            <div className="relative w-full md:w-72">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-zinc-500" />
              </div>
              <input
                type="text"
                placeholder="Search logs..."
                className="block w-full pl-10 pr-3 py-2 border border-zinc-800 rounded-lg leading-5 bg-zinc-900 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          )}
        </header>

        {/* Upload Zone */}
        {data.length === 0 ? (
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200 
              ${isDragActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900/50'}`}
          >
            <input {...getInputProps()} />
            <UploadCloud className="w-16 h-16 mx-auto text-zinc-600 mb-4" />
            <p className="text-lg font-medium text-zinc-300">Drag & drop your CSV log here</p>
            <p className="text-zinc-500 mt-2 text-sm">or click to select file</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            
            {/* View Toggles */}
            <div className="flex bg-zinc-900 p-1 rounded-lg w-fit border border-zinc-800">
              <button
                onClick={() => setViewMode('raw')}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'raw' ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                <List className="w-4 h-4 mr-2" /> Raw View
              </button>
              <button
                onClick={() => setViewMode('daily')}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'daily' ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                <Calendar className="w-4 h-4 mr-2" /> Daily View
              </button>
              <button
                onClick={() => setViewMode('monthly')}
                className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'monthly' ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                <BarChart2 className="w-4 h-4 mr-2" /> Monthly View
              </button>
            </div>

            {/* Main Content Area */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden shadow-2xl relative">
              <div className="overflow-x-auto h-[600px] overflow-y-auto custom-scrollbar">
                <table className="min-w-full divide-y divide-zinc-800">
                  <thead className="bg-zinc-900/95 sticky top-0 z-10 backdrop-blur-sm border-b border-zinc-800">
                    <tr>
                      {viewMode === 'raw' && (
                        <>
                          <Th label="Date" sortKey="Date" />
                          <Th label="Time" sortKey="Time" />
                          <Th label="Event" sortKey="Event" />
                          <Th label="To" sortKey="To" />
                          <Th label="Duration (s)" sortKey="Duration" className="text-right" />
                          <Th label="Data Up" sortKey="DataUp" className="text-right" />
                          <Th label="Data Down" sortKey="DataDown" className="text-right" />
                          <Th label="Price" sortKey="Price" className="text-right" />
                        </>
                      )}
                      {viewMode === 'daily' && (
                        <>
                          <Th label="Date" sortKey="Date" />
                          <Th label="Events" sortKey="Events" className="text-right" />
                          <Th label="Duration (s)" sortKey="Duration" className="text-right" />
                          <Th label="Total Data" sortKey="TotalData" className="text-right" />
                          <Th label="Data Up" sortKey="DataUp" className="text-right" />
                          <Th label="Data Down" sortKey="DataDown" className="text-right" />
                        </>
                      )}
                      {viewMode === 'monthly' && (
                        <>
                          <th className="px-4 py-3 w-8"></th>
                          <Th label="Month" sortKey="Month" />
                          <Th label="Events" sortKey="Events" className="text-right" />
                          <Th label="Duration (s)" sortKey="Duration" className="text-right" />
                          <Th label="Total Data" sortKey="TotalData" className="text-right" />
                          <Th label="Data Up" sortKey="DataUp" className="text-right" />
                          <Th label="Data Down" sortKey="DataDown" className="text-right" />
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50 bg-zinc-900">
                    
                    {/* RAW VIEW */}
                    {viewMode === 'raw' && rawSorted.map((row, i) => (
                      <tr key={i} className="hover:bg-zinc-800/50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-300">
                          {row.DisplayDate}
                          {row.DisplayDay && <span className="text-xs text-zinc-500 ml-1">{row.DisplayDay}</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-400">{row.Time}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-300">
                          <span className="bg-zinc-800 px-2 py-1 rounded text-xs">{row.Event}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-400">{row.To}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-300 text-right font-mono">{row.Duration}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-400 text-right font-mono">{formatBytes(row.DataUp)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-cyan-400 text-right font-mono">{formatBytes(row.DataDown)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-green-400 text-right">{row.Price}</td>
                      </tr>
                    ))}

                    {/* DAILY VIEW */}
                    {viewMode === 'daily' && dailyData.map((row, i) => (
                      <tr key={i} className="hover:bg-zinc-800/50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-zinc-200">
                          {row.DisplayDate}
                          {row.DisplayDay && <span className="text-xs text-zinc-500 font-normal ml-1">{row.DisplayDay}</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-400 text-right">{row.Events}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-300 text-right font-mono">{row.Duration}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-indigo-400 font-medium text-right font-mono">{formatBytes(row.TotalData)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-400 text-right font-mono">{formatBytes(row.DataUp)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-cyan-400 text-right font-mono">{formatBytes(row.DataDown)}</td>
                      </tr>
                    ))}

                    {/* MONTHLY VIEW */}
                    {viewMode === 'monthly' && monthlyData.map((row, i) => (
                      <React.Fragment key={i}>
                        <tr 
                          className="hover:bg-zinc-800/50 transition-colors cursor-pointer group"
                          onClick={() => toggleMonthExpand(row.Month)}
                        >
                          <td className="px-4 py-3 whitespace-nowrap w-8 text-zinc-500 group-hover:text-zinc-300 transition-colors">
                            {expandedMonths[row.Month] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-zinc-200">{row.Month}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-400 text-right">{row.Events}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-300 text-right font-mono">{row.Duration}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-indigo-400 font-bold text-right font-mono">{formatBytes(row.TotalData)}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-zinc-400 text-right font-mono">{formatBytes(row.DataUp)}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-cyan-400 text-right font-mono">{formatBytes(row.DataDown)}</td>
                        </tr>
                        {/* Nested Daily Breakdown */}
                        {expandedMonths[row.Month] && (
                          <tr>
                            <td colSpan={7} className="p-0 border-b border-zinc-800">
                              <div className="bg-zinc-950/50 py-4 px-12 border-t border-zinc-800/50">
                                <h4 className="text-xs font-semibold text-zinc-500 uppercase mb-3 flex items-center">
                                  <Calendar className="w-3 h-3 mr-2" />
                                  Daily Breakdown: {row.Month}
                                </h4>
                                <table className="min-w-full divide-y divide-zinc-800/30">
                                  <thead>
                                    <tr>
                                      <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">Date</th>
                                      <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500">Events</th>
                                      <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500">Duration</th>
                                      <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500">Total Data</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-zinc-800/30">
                                    {row.DailyArr.map((dDay, j) => (
                                      <tr key={j} className="hover:bg-zinc-800/30">
                                        <td className="px-3 py-2 whitespace-nowrap text-sm text-zinc-300">
                                          {dDay.DisplayDate}
                                          {dDay.DisplayDay && <span className="text-xs text-zinc-500 ml-1">{dDay.DisplayDay}</span>}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap text-sm text-zinc-400 text-right">{dDay.Events}</td>
                                        <td className="px-3 py-2 whitespace-nowrap text-sm text-zinc-400 text-right font-mono">{dDay.Duration}</td>
                                        <td className="px-3 py-2 whitespace-nowrap text-sm text-indigo-400/80 text-right font-mono">{formatBytes(dDay.TotalData)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                    
                    {filteredData.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-zinc-500">
                          No results found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Custom Scrollbar Styles for the app */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #18181b; 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a; 
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46; 
        }
      `}} />
    </div>
  );
}
