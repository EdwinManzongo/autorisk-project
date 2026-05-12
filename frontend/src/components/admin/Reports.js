import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { BarChart3, TrendingUp, Brain } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('ar_token')}` });

const COLORS = ['#1e3a8a', '#2563eb', '#0ea5e9', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
const RISK_COLORS = { low: '#10b981', medium: '#f59e0b', high: '#f97316', very_high: '#ef4444' };

export default function Reports() {
  const [riskData, setRiskData] = useState([]);
  const [modelPerf, setModelPerf] = useState(null);
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    axios.get(`${API}/reports/risk-analysis`, { headers: headers() }).then(r => setRiskData(r.data)).catch(console.error);
    axios.get(`${API}/reports/model-performance`, { headers: headers() }).then(r => setModelPerf(r.data)).catch(console.error);
    axios.get(`${API}/reports/dashboard`, { headers: headers() }).then(r => setDashboard(r.data)).catch(console.error);
  }, []);

  const riskChartData = riskData.map(r => ({
    name: r._id?.replace('_', ' ') || 'Unknown',
    count: r.count,
    avgPremium: r.avg_premium,
    avgRisk: (r.avg_risk_score * 100).toFixed(1),
    fill: RISK_COLORS[r._id] || '#94a3b8',
  }));

  const coveragePieData = Object.entries(dashboard?.coverage_distribution || {}).map(([k, v], i) => ({
    name: k.replace(/_/g, ' '),
    value: v,
    fill: COLORS[i % COLORS.length],
  }));

  const riskPieData = Object.entries(dashboard?.risk_distribution || {}).map(([k, v]) => ({
    name: k.replace('_', ' '),
    value: v,
    fill: RISK_COLORS[k] || '#94a3b8',
  }));

  return (
    <div className="space-y-6">
      {/* Model performance banner */}
      {modelPerf && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Predictions', value: modelPerf.total_predictions },
            { label: 'Avg GB Risk Score', value: modelPerf.avg_gb_risk_score?.toFixed(4) },
            { label: 'Avg DL Risk Score', value: modelPerf.avg_dl_risk_score?.toFixed(4) },
            { label: 'Avg Recommended Premium', value: `$${modelPerf.avg_recommended_premium?.toFixed(2)}` },
          ].map(s => (
            <Card key={s.label} className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-blue-900">{s.value}</p>
                <p className="text-xs text-gray-500 mt-1">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Risk by level bar chart */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-700" /> Quotes by Risk Level
            </CardTitle>
          </CardHeader>
          <CardContent>
            {riskChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={riskChartData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(val, name) => [val, name === 'count' ? 'Quotes' : name]} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {riskChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No quote data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Avg premium by risk */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-700" /> Avg. Premium by Risk Level
            </CardTitle>
          </CardHeader>
          <CardContent>
            {riskChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={riskChartData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                  <Tooltip formatter={(val) => [`$${val}`, 'Avg Premium']} />
                  <Bar dataKey="avgPremium" radius={[4, 4, 0, 0]}>
                    {riskChartData.map((entry, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Coverage pie */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Coverage Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {coveragePieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={coveragePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                    {coveragePieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No policy data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Risk distribution pie */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Risk Level Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {riskPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={riskPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                    {riskPieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No quote data yet</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
