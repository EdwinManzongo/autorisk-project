import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users, FileText, ShieldCheck, Clock, TrendingUp, DollarSign,
  AlertTriangle, CheckCircle,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('ar_token')}` });

const RISK_COLORS = { low: 'bg-green-100 text-green-800', medium: 'bg-yellow-100 text-yellow-800', high: 'bg-orange-100 text-orange-800', very_high: 'bg-red-100 text-red-800' };

export default function Overview() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/reports/dashboard`, { headers: headers() })
      .then(r => setStats(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-blue-900">Loading dashboard...</div>;

  const cards = [
    { label: 'Total Customers', value: stats?.total_customers || 0, icon: Users, color: 'text-blue-700', bg: 'bg-blue-50' },
    { label: 'Total Quotes', value: stats?.total_quotes || 0, icon: FileText, color: 'text-indigo-700', bg: 'bg-indigo-50' },
    { label: 'Active Policies', value: stats?.active_policies || 0, icon: ShieldCheck, color: 'text-green-700', bg: 'bg-green-50' },
    { label: 'Pending Quotes', value: stats?.pending_quotes || 0, icon: Clock, color: 'text-amber-700', bg: 'bg-amber-50' },
    { label: 'Annual Premium Pool', value: `$${(stats?.total_annual_premium_usd || 0).toLocaleString()}`, icon: DollarSign, color: 'text-emerald-700', bg: 'bg-emerald-50' },
    { label: 'Avg. Annual Premium', value: `$${(stats?.avg_annual_premium_usd || 0).toFixed(2)}`, icon: TrendingUp, color: 'text-purple-700', bg: 'bg-purple-50' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map(c => (
          <Card key={c.label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center mb-3`}>
                <c.icon className={`w-5 h-5 ${c.color}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{c.value}</p>
              <p className="text-xs text-gray-500 mt-1">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Risk Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {['low', 'medium', 'high', 'very_high'].map(level => {
              const count = stats?.risk_distribution?.[level] || 0;
              const total = Object.values(stats?.risk_distribution || {}).reduce((a, b) => a + b, 0);
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={level} className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium w-20 text-center ${RISK_COLORS[level]}`}>
                    {level.replace('_', ' ')}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-600 w-12 text-right">{count} ({pct}%)</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-500" /> Coverage Mix
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(stats?.coverage_distribution || {}).map(([cov, count]) => (
              <div key={cov} className="flex items-center justify-between">
                <span className="text-sm text-gray-700 capitalize">{cov.replace(/_/g, ' ')}</span>
                <Badge variant="secondary" className="text-xs">{count}</Badge>
              </div>
            ))}
            {!Object.keys(stats?.coverage_distribution || {}).length && (
              <p className="text-sm text-gray-400">No policies yet</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(stats?.recent_quotes || []).slice(0, 5).map((q, i) => (
              <div key={i} className="flex items-center justify-between py-1 border-b last:border-0">
                <div>
                  <p className="text-xs font-medium text-gray-800">{q.customer_name || 'Customer'}</p>
                  <p className="text-xs text-gray-400">{q.quote_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-blue-800">${q.recommended_premium_usd?.toFixed(2)}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    q.status === 'accepted' ? 'bg-green-100 text-green-700' :
                    q.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>{q.status}</span>
                </div>
              </div>
            ))}
            {!stats?.recent_quotes?.length && <p className="text-sm text-gray-400">No recent quotes</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
