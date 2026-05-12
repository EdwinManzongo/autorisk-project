import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Brain, BarChart3, Cpu, Layers, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('ar_token')}` });

export default function ModelInsights() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    axios.get(`${API}/quotes/model/stats`, { headers: headers() })
      .then(r => setStats(r.data))
      .catch(console.error);
  }, []);

  if (!stats) return <div className="flex items-center justify-center h-64 text-blue-900">Loading model data...</div>;

  const importanceData = Object.entries(stats.feature_importance || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, imp], i) => ({
      name: name.replace(/_/g, ' '),
      importance: (imp * 100).toFixed(1),
      fill: i < 3 ? '#1e3a8a' : i < 6 ? '#2563eb' : i < 10 ? '#0ea5e9' : '#94a3b8',
    }));

  return (
    <div className="space-y-6">
      {/* Architecture overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-900 to-blue-700 text-white">
          <CardContent className="p-5">
            <Brain className="w-8 h-8 text-blue-200 mb-3" />
            <p className="text-lg font-bold">Hybrid Ensemble</p>
            <p className="text-blue-200 text-sm mt-1">DL (45%) + Gradient Boosting (55%)</p>
            <Separator className="my-3 bg-blue-600" />
            <p className="text-xs text-blue-200">Model Version: <strong className="text-white">{stats.version}</strong></p>
            <p className="text-xs text-blue-200">Base Rate: <strong className="text-white">{stats.base_premium_rate}</strong></p>
            <p className="text-xs text-blue-200">Premium Floor: <strong className="text-white">${stats.premium_floor_usd}</strong></p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <TrendingUp className="w-8 h-8 text-green-600 mb-3" />
            <p className="text-lg font-bold text-gray-900">Gradient Boosting</p>
            <p className="text-gray-500 text-sm">scikit-learn GBR</p>
            <Separator className="my-3" />
            <div className="space-y-1 text-xs text-gray-600">
              <div className="flex justify-between"><span>Estimators</span><Badge variant="outline">{stats.gb_n_estimators}</Badge></div>
              <div className="flex justify-between"><span>Ensemble Weight</span><Badge variant="outline">{((stats.ensemble_weights?.gradient_boosting ?? 0.55) * 100).toFixed(0)}%</Badge></div>
              <div className="flex justify-between"><span>Architecture</span><Badge variant="outline">Tree Ensemble</Badge></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <Layers className="w-8 h-8 text-purple-600 mb-3" />
            <p className="text-lg font-bold text-gray-900">Deep Learning (MLP)</p>
            <p className="text-gray-500 text-sm">scikit-learn MLPRegressor</p>
            <Separator className="my-3" />
            <div className="space-y-1 text-xs text-gray-600">
              <div className="flex justify-between"><span>Hidden Layers</span>
                <Badge variant="outline">{stats.dl_hidden_layers?.join(' → ')}</Badge>
              </div>
              <div className="flex justify-between"><span>Ensemble Weight</span><Badge variant="outline">{((stats.ensemble_weights?.deep_learning ?? 0.45) * 100).toFixed(0)}%</Badge></div>
              <div className="flex justify-between"><span>Activation</span><Badge variant="outline" className="capitalize">{stats.dl_activation ?? 'relu'}</Badge></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature importance */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-700" /> Feature Importance (Top 15)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={importanceData} layout="vertical" margin={{ left: 120, right: 30 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
              <Tooltip formatter={v => [`${v}%`, 'Importance']} />
              <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                {importanceData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Risk factor descriptions */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-600" /> Feature Vector ({stats.feature_count} dimensions)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {[
              { group: 'Demographics', color: 'bg-blue-100 text-blue-800', features: ['Age', 'Gender', 'Marital Status', 'Occupation Risk', 'Location Risk'] },
              { group: 'Driving History', color: 'bg-red-100 text-red-800', features: ['Years Experience', 'Accidents (5yr)', 'At-fault Accidents', 'Violations (3yr)', 'DUI History', 'Claims (5yr)', 'Suspensions'] },
              { group: 'Vehicle', color: 'bg-indigo-100 text-indigo-800', features: ['Vehicle Age', 'Vehicle Value (log)', 'Engine Size', 'Safety Score'] },
              { group: 'Usage & Mileage', color: 'bg-green-100 text-green-800', features: ['Annual Mileage', 'Usage Type (Personal/Commercial)'] },
              { group: 'Policy', color: 'bg-yellow-100 text-yellow-800', features: ['Coverage Type', 'Deductible Amount', 'No-Claims Years', 'Policy Lapse History'] },
              { group: 'Behavioral', color: 'bg-purple-100 text-purple-800', features: ['Night Driving %', 'Harsh Braking', 'Telematics Score'] },
            ].map(g => (
              <div key={g.group} className="p-3 rounded-lg border border-gray-100">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${g.color} mb-2 inline-block`}>{g.group}</span>
                <ul className="space-y-0.5">
                  {g.features.map(f => <li key={f} className="text-xs text-gray-600">• {f}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
