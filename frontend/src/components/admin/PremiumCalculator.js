import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { parseApiError } from '@/lib/utils';
import {
  Calculator, ChevronRight, ChevronLeft, CheckCircle, AlertTriangle,
  Brain, TrendingUp, Shield, DollarSign, User, Car, MapPin, Activity, Info,
  Upload, Download, RefreshCw, Gauge, Zap, Moon, AlertOctagon, FileSpreadsheet,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('ar_token')}` });

const RISK_COLORS = {
  low:       'bg-green-100  text-green-800  border-green-200',
  medium:    'bg-yellow-100 text-yellow-800 border-yellow-200',
  high:      'bg-orange-100 text-orange-800 border-orange-200',
  very_high: 'bg-red-100    text-red-800    border-red-200',
};
const RISK_BAR_COLORS = { low: '#4ade80', medium: '#fbbf24', high: '#f97316', very_high: '#ef4444' };

const STEPS = ['Customer & Vehicle', 'Driving History', 'Location', 'Policy & Coverage', 'Results'];

// ── Telematics metric configuration ───────────────────────────────────────────
const TEL_METRICS = [
  {
    key:        'avg_monthly_mileage_km',
    label:      'Monthly Mileage',
    unit:       'km / mo',
    icon:       Gauge,
    max:        5000,
    benchmarks: 'Fleet avg 800 km',
    bands: [
      { upTo: 1000, color: '#22c55e', bg: '#f0fdf4', label: 'Low',      text: 'text-green-700'  },
      { upTo: 2500, color: '#f59e0b', bg: '#fffbeb', label: 'Moderate', text: 'text-amber-700'  },
      { upTo: 4000, color: '#f97316', bg: '#fff7ed', label: 'High',     text: 'text-orange-700' },
      { upTo: 9999, color: '#ef4444', bg: '#fef2f2', label: 'Very High',text: 'text-red-700'    },
    ],
  },
  {
    key:        'hard_braking_events_monthly',
    label:      'Hard Braking',
    unit:       'events / mo',
    icon:       AlertOctagon,
    max:        20,
    benchmarks: 'Fleet avg 2 / mo',
    bands: [
      { upTo: 1,  color: '#22c55e', bg: '#f0fdf4', label: 'Low',      text: 'text-green-700'  },
      { upTo: 4,  color: '#f59e0b', bg: '#fffbeb', label: 'Moderate', text: 'text-amber-700'  },
      { upTo: 9,  color: '#f97316', bg: '#fff7ed', label: 'High',     text: 'text-orange-700' },
      { upTo: 99, color: '#ef4444', bg: '#fef2f2', label: 'Very High',text: 'text-red-700'    },
    ],
  },
  {
    key:        'speeding_incidents_monthly',
    label:      'Speeding Incidents',
    unit:       'incidents / mo',
    icon:       Zap,
    max:        10,
    benchmarks: 'Fleet avg 1 / mo',
    bands: [
      { upTo: 0,  color: '#22c55e', bg: '#f0fdf4', label: 'None',     text: 'text-green-700'  },
      { upTo: 2,  color: '#f59e0b', bg: '#fffbeb', label: 'Moderate', text: 'text-amber-700'  },
      { upTo: 5,  color: '#f97316', bg: '#fff7ed', label: 'High',     text: 'text-orange-700' },
      { upTo: 99, color: '#ef4444', bg: '#fef2f2', label: 'Very High',text: 'text-red-700'    },
    ],
  },
  {
    key:        'night_driving_pct',
    label:      'Night Driving',
    unit:       '% of trips',
    icon:       Moon,
    max:        100,
    benchmarks: 'Fleet avg 15%',
    bands: [
      { upTo: 20, color: '#22c55e', bg: '#f0fdf4', label: 'Low',      text: 'text-green-700'  },
      { upTo: 40, color: '#f59e0b', bg: '#fffbeb', label: 'Moderate', text: 'text-amber-700'  },
      { upTo: 60, color: '#f97316', bg: '#fff7ed', label: 'High',     text: 'text-orange-700' },
      { upTo: 100,color: '#ef4444', bg: '#fef2f2', label: 'Very High',text: 'text-red-700'    },
    ],
  },
];

const getBand = (metric, value) => metric.bands.find(b => value <= b.upTo) ?? metric.bands[metric.bands.length - 1];

const overallTelScore = (dh) => {
  const scores = [
    getBand(TEL_METRICS[0], dh.avg_monthly_mileage_km).label,
    getBand(TEL_METRICS[1], dh.hard_braking_events_monthly).label,
    getBand(TEL_METRICS[2], dh.speeding_incidents_monthly).label,
    getBand(TEL_METRICS[3], dh.night_driving_pct).label,
  ];
  const weights = { None: 0, Low: 0, Moderate: 1, High: 2, 'Very High': 3 };
  const total = scores.reduce((s, l) => s + (weights[l] ?? 0), 0);
  if (total === 0) return { label: 'Excellent', color: '#22c55e', bg: 'bg-green-50',  text: 'text-green-800',  border: 'border-green-200' };
  if (total <= 2)  return { label: 'Good',      color: '#84cc16', bg: 'bg-lime-50',   text: 'text-lime-800',   border: 'border-lime-200'  };
  if (total <= 4)  return { label: 'Moderate',  color: '#f59e0b', bg: 'bg-amber-50',  text: 'text-amber-800',  border: 'border-amber-200' };
  if (total <= 7)  return { label: 'High Risk',  color: '#f97316', bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200'};
  return             { label: 'Very High Risk',  color: '#ef4444', bg: 'bg-red-50',    text: 'text-red-800',    border: 'border-red-200'   };
};

const CITIES = [
  { label: 'Harare',         crime: 0.55 },
  { label: 'Bulawayo',       crime: 0.45 },
  { label: 'Mutare',         crime: 0.40 },
  { label: 'Gweru',          crime: 0.35 },
  { label: 'Kwekwe',         crime: 0.38 },
  { label: 'Masvingo',       crime: 0.30 },
  { label: 'Chinhoyi',       crime: 0.28 },
  { label: 'Victoria Falls', crime: 0.22 },
  { label: 'Other',          crime: 0.35 },
];

const calcAge = (dob) => {
  if (!dob) return null;
  const today = new Date();
  const d = new Date(dob);
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
};

const calcExperience = (licDate) => {
  if (!licDate) return null;
  const today = new Date();
  const d = new Date(licDate);
  let exp = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) exp--;
  return Math.max(0, exp);
};

export default function PremiumCalculator({ onQuoteCreated }) {
  const [step, setStep] = useState(0);
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [telUploading, setTelUploading] = useState(false);
  const [telLoaded, setTelLoaded] = useState(null);   // period_month of loaded record
  const telFileRef = useRef(null);

  const [form, setForm] = useState({
    customer_id: '',
    vehicle_id: '',
    driving_history: {
      accidents_last_5_years: 0,
      at_fault_accidents: 0,
      traffic_violations_last_3_years: 0,
      dui_convictions: 0,
      claims_last_5_years: 0,
      license_suspensions: 0,
      no_claims_years: 0,
      avg_monthly_mileage_km: 800,
      hard_braking_events_monthly: 0,
      speeding_incidents_monthly: 0,
      night_driving_pct: 10,
    },
    location_risk: {
      city: 'Harare',
      crime_rate_score: 0.55,
      accident_prone_area: false,
      flood_risk_score: 0.10,
      weather_risk_score: 0.20,
    },
    policy_details: {
      coverage_type: 'comprehensive',
      sum_insured_usd: '',
      deductible_usd: 500,
      policy_duration_months: 12,
      payment_frequency: 'monthly',
      has_previous_insurance: false,
      previous_insurer: '',
      previous_policy_lapse_months: 0,
      no_claims_years: 0,
    },
    notes: '',
  });

  useEffect(() => {
    axios.get(`${API}/customers`, { headers: headers() })
      .then(r => setCustomers(r.data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (form.customer_id) {
      axios.get(`${API}/vehicles/customer/${form.customer_id}`, { headers: headers() })
        .then(r => setVehicles(r.data)).catch(console.error);
      const c = customers.find(x => x.id === form.customer_id);
      setSelectedCustomer(c || null);
    }
  }, [form.customer_id]);

  useEffect(() => {
    if (form.vehicle_id) {
      const v = vehicles.find(x => x.id === form.vehicle_id);
      setSelectedVehicle(v || null);
      if (v) {
        setForm(f => ({
          ...f,
          policy_details: {
            ...f.policy_details,
            sum_insured_usd: v.vehicle_value_usd || '',
          }
        }));
      }
    }
  }, [form.vehicle_id]);

  const setDriving = (k, v) => setForm(f => ({ ...f, driving_history: { ...f.driving_history, [k]: v } }));
  const setLocation = (k, v) => setForm(f => ({ ...f, location_risk: { ...f.location_risk, [k]: v } }));
  const setPolicy = (k, v) => setForm(f => ({ ...f, policy_details: { ...f.policy_details, [k]: v } }));

  const handleCityChange = (city) => {
    const c = CITIES.find(x => x.label === city);
    setForm(f => ({
      ...f,
      location_risk: { ...f.location_risk, city, crime_rate_score: c?.crime ?? 0.35 }
    }));
  };

  // ── Telematics helpers ─────────────────────────────────────────────────────
  const applyTelematicsRecord = (rec) => {
    setDriving('avg_monthly_mileage_km',      rec.avg_monthly_mileage_km      ?? 800);
    setDriving('hard_braking_events_monthly', rec.hard_braking_events_monthly ?? 0);
    setDriving('speeding_incidents_monthly',  rec.speeding_incidents_monthly  ?? 0);
    setDriving('night_driving_pct',           rec.night_driving_pct           ?? 10);
    setTelLoaded(rec.period_month ?? 'uploaded');
  };

  const handleAutoLoad = async () => {
    if (!form.vehicle_id) { toast.error('Select a vehicle first'); return; }
    try {
      const res = await axios.get(`${API}/telematics/vehicle/${form.vehicle_id}/latest`, { headers: headers() });
      applyTelematicsRecord(res.data);
      toast.success(`Telematics loaded from ${res.data.period_month}`);
    } catch {
      toast.error('No telematics record found for this vehicle. Upload one first.');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await axios.get(`${API}/telematics/template`, { headers: headers(), responseType: 'blob' });
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href  = url;
      const cd   = res.headers['content-disposition'] || '';
      const name = cd.match(/filename="(.+)"/)?.[1] || 'AutoRisk_Telematics_Template.xlsx';
      link.setAttribute('download', name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded');
    } catch {
      toast.error('Failed to download template');
    }
  };

  const handleTelUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTelUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axios.post(`${API}/telematics/upload`, fd, {
        headers: { ...headers(), 'Content-Type': 'multipart/form-data' },
      });
      const records = res.data.records || [];
      if (records.length === 0) { toast.error('No data rows found in file'); return; }
      // Apply the first row that matches current vehicle, or just the first row
      const match = records.find(r =>
        selectedVehicle && r.registration_number?.toLowerCase() === selectedVehicle.registration_number?.toLowerCase()
      ) || records[0];
      applyTelematicsRecord(match);
      toast.success(`Telematics loaded from ${file.name} (${records.length} row${records.length > 1 ? 's' : ''} saved)`);
    } catch (err) {
      toast.error(parseApiError(err, 'Upload failed'));
    } finally {
      setTelUploading(false);
      e.target.value = '';
    }
  };

  // Derived display values from customer DOB and vehicle year
  const derivedAge = selectedCustomer ? calcAge(selectedCustomer.date_of_birth) : null;
  const derivedExp = selectedCustomer ? calcExperience(selectedCustomer.license_issue_date) ?? selectedCustomer.years_driving_experience : null;
  const derivedCarAge = selectedVehicle ? new Date().getFullYear() - selectedVehicle.year : null;

  const canNext = () => {
    if (step === 0) return form.customer_id && form.vehicle_id;
    if (step === 3) return form.policy_details.sum_insured_usd > 0;
    return true;
  };

  const handleCalculate = async () => {
    setLoading(true);
    try {
      const payload = {
        ...form,
        policy_details: {
          ...form.policy_details,
          no_claims_years: form.driving_history.no_claims_years,
          sum_insured_usd: parseFloat(form.policy_details.sum_insured_usd) || 0,
        },
      };
      const res = await axios.post(`${API}/quotes/calculate`, payload, { headers: headers() });
      setResult(res.data);
      setStep(4);
      toast.success('Premium calculated successfully');
    } catch (err) {
      toast.error(parseApiError(err, 'Calculation failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep(0);
    setResult(null);
    setForm(f => ({ ...f, customer_id: '', vehicle_id: '' }));
    setSelectedCustomer(null);
    setSelectedVehicle(null);
  };

  const riskScore = result?.risk_breakdown?.risk_score_pct ?? 0;
  const riskLevel = result?.risk_breakdown?.risk_level ?? 'low';
  const riskBarColor = RISK_BAR_COLORS[riskLevel] ?? '#94a3b8';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-between">
        {STEPS.map((s, i) => (
          <React.Fragment key={i}>
            <div className={`flex items-center gap-2 ${i <= step ? 'text-blue-900' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                i < step ? 'bg-blue-900 border-blue-900 text-white' :
                i === step ? 'border-blue-900 text-blue-900' : 'border-gray-300 text-gray-400'
              }`}>
                {i < step ? <CheckCircle className="w-4 h-4" /> : i + 1}
              </div>
              <span className="hidden md:block text-xs font-medium">{s}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-blue-900' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ── Step 0: Customer & Vehicle ─────────────────────────────────────── */}
      {step === 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <User className="w-5 h-5" /> Customer & Vehicle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Customer</Label>
              <Select value={form.customer_id} onValueChange={v => setForm(f => ({ ...f, customer_id: v, vehicle_id: '' }))}>
                <SelectTrigger><SelectValue placeholder="Select customer..." /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.first_name} {c.last_name} — {c.customer_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!customers.length && <p className="text-xs text-amber-600">No customers yet — add one first.</p>}
            </div>

            {selectedCustomer && (
              <div className="bg-blue-50 rounded-lg p-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div><span className="text-gray-500">Age</span><p className="font-semibold">{derivedAge ?? '—'} yrs</p></div>
                <div><span className="text-gray-500">Experience</span><p className="font-semibold">{derivedExp ?? selectedCustomer.years_driving_experience} yrs</p></div>
                <div><span className="text-gray-500">Gender</span><p className="font-semibold capitalize">{selectedCustomer.gender}</p></div>
                <div><span className="text-gray-500">Occupation</span><p className="font-semibold">{selectedCustomer.occupation}</p></div>
              </div>
            )}

            {form.customer_id && (
              <div className="space-y-2">
                <Label>Vehicle</Label>
                <Select value={form.vehicle_id} onValueChange={v => setForm(f => ({ ...f, vehicle_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select vehicle..." /></SelectTrigger>
                  <SelectContent>
                    {vehicles.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.year} {v.make} {v.model} — {v.registration_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!vehicles.length && <p className="text-xs text-amber-600">No vehicles for this customer — add one first.</p>}
              </div>
            )}

            {selectedVehicle && (
              <div className="bg-indigo-50 rounded-lg p-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div><span className="text-gray-500">Car Age</span><p className="font-semibold">{derivedCarAge} yrs</p></div>
                <div><span className="text-gray-500">Engine</span><p className="font-semibold capitalize">{selectedVehicle.engine_type || 'Petrol'}</p></div>
                <div><span className="text-gray-500">Value</span><p className="font-semibold">${selectedVehicle.vehicle_value_usd?.toLocaleString()}</p></div>
                <div><span className="text-gray-500">Anti-theft</span><p className="font-semibold">{selectedVehicle.anti_theft ? 'Yes' : 'No'}</p></div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Step 1: Driving History + Telematics ──────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900 text-base">
                <Activity className="w-5 h-5" /> Driving Record
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { k: 'accidents_last_5_years',         label: 'Accidents (last 5 years)', max: 10 },
                { k: 'at_fault_accidents',              label: 'At-fault accidents',        max: 5  },
                { k: 'traffic_violations_last_3_years', label: 'Traffic violations (3 yrs)', max: 10 },
                { k: 'dui_convictions',                 label: 'DUI / DWI convictions',     max: 3  },
                { k: 'claims_last_5_years',             label: 'Claims (last 5 years)',      max: 8  },
                { k: 'license_suspensions',             label: 'Licence suspensions',        max: 3  },
                { k: 'no_claims_years',                 label: 'No-claims bonus years',      max: 15 },
              ].map(f => (
                <div key={f.k} className="space-y-1">
                  <Label className="text-sm">{f.label}</Label>
                  <Input type="number" min={0} max={f.max}
                    value={form.driving_history[f.k]}
                    onChange={e => setDriving(f.k, parseInt(e.target.value) || 0)} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <CardTitle className="flex items-center gap-2 text-blue-900 text-base">
                  <Brain className="w-5 h-5" /> Telematics / Behavioural Data
                  <span className="text-xs text-gray-400 font-normal">(monthly averages)</span>
                  {telLoaded && (
                    <Badge className="bg-green-100 text-green-800 text-xs font-normal border border-green-200 ml-1">
                      <CheckCircle className="w-3 h-3 mr-1" /> Loaded · {telLoaded}
                    </Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-xs border-blue-200 text-blue-800 hover:bg-blue-50 gap-1.5"
                    onClick={handleDownloadTemplate}
                  >
                    <Download className="w-3.5 h-3.5" /> Template
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-xs border-blue-200 text-blue-800 hover:bg-blue-50 gap-1.5"
                    onClick={() => telFileRef.current?.click()}
                    disabled={telUploading}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {telUploading ? 'Uploading...' : 'Upload Excel'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="text-xs bg-blue-900 hover:bg-blue-800 gap-1.5"
                    onClick={handleAutoLoad}
                    disabled={!form.vehicle_id}
                    title="Load latest stored telematics for this vehicle"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Auto-load
                  </Button>
                  <input
                    ref={telFileRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleTelUpload}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!telLoaded ? (
                /* ── Empty state ─────────────────────────────────────────── */
                <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
                    <FileSpreadsheet className="w-8 h-8 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">No telematics data loaded</p>
                    <p className="text-sm text-gray-400 mt-1 max-w-sm">
                      Upload an Excel file or auto-load from stored records to populate
                      behavioural risk data for this vehicle.
                    </p>
                  </div>
                  <div className="flex gap-3 flex-wrap justify-center">
                    <Button size="sm" variant="outline"
                      className="gap-1.5 border-blue-200 text-blue-800 hover:bg-blue-50"
                      onClick={handleDownloadTemplate}>
                      <Download className="w-3.5 h-3.5" /> Download Template
                    </Button>
                    <Button size="sm" variant="outline"
                      className="gap-1.5 border-blue-200 text-blue-800 hover:bg-blue-50"
                      onClick={() => telFileRef.current?.click()}
                      disabled={telUploading}>
                      <Upload className="w-3.5 h-3.5" /> Upload Excel
                    </Button>
                    {form.vehicle_id && (
                      <Button size="sm"
                        className="gap-1.5 bg-blue-900 hover:bg-blue-800"
                        onClick={handleAutoLoad}>
                        <RefreshCw className="w-3.5 h-3.5" /> Auto-load Latest
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 italic">
                    Default values will be used for the calculation if skipped.
                  </p>
                </div>
              ) : (
                /* ── Loaded: metric cards ────────────────────────────────── */
                <div className="space-y-4">
                  {/* 4-metric grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {TEL_METRICS.map(metric => {
                      const val  = form.driving_history[metric.key] ?? 0;
                      const band = getBand(metric, val);
                      const pct  = Math.min((val / metric.max) * 100, 100);
                      const Icon = metric.icon;
                      return (
                        <div
                          key={metric.key}
                          className="rounded-xl border p-4 flex flex-col gap-2 transition-all"
                          style={{ background: band.bg, borderColor: band.color + '40' }}
                        >
                          {/* Icon + label row */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Icon className="w-4 h-4 flex-shrink-0" style={{ color: band.color }} />
                              <span className="text-xs font-medium text-gray-600 leading-tight">
                                {metric.label}
                              </span>
                            </div>
                            <span
                              className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${band.text}`}
                              style={{ background: band.color + '20' }}
                            >
                              {band.label}
                            </span>
                          </div>

                          {/* Big value */}
                          <div className="flex items-end gap-1">
                            <span className="text-3xl font-extrabold text-gray-900 leading-none">
                              {typeof val === 'number' && val % 1 !== 0
                                ? val.toFixed(1)
                                : val.toLocaleString()}
                            </span>
                            <span className="text-xs text-gray-500 mb-0.5">{metric.unit}</span>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full h-1.5 bg-white/60 rounded-full overflow-hidden">
                            <div
                              className="h-1.5 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, background: band.color }}
                            />
                          </div>

                          {/* Benchmark */}
                          <p className="text-xs text-gray-400">{metric.benchmarks}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Overall score banner */}
                  {(() => {
                    const score = overallTelScore(form.driving_history);
                    return (
                      <div className={`rounded-xl border px-4 py-3 flex items-center justify-between ${score.bg} ${score.border}`}>
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4" style={{ color: score.color }} />
                          <span className="text-sm font-semibold text-gray-700">Overall Telematics Score</span>
                        </div>
                        <span
                          className={`text-sm font-bold px-3 py-1 rounded-full border ${score.text} ${score.border}`}
                          style={{ background: score.color + '20' }}
                        >
                          {score.label}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Source note */}
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    Data loaded from Excel · Period: <strong className="text-gray-600">{telLoaded}</strong>
                    <button
                      className="ml-auto text-blue-600 hover:text-blue-800 underline"
                      onClick={() => telFileRef.current?.click()}
                    >
                      Replace
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Step 2: Location ──────────────────────────────────────────────── */}
      {step === 2 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <MapPin className="w-5 h-5" /> Location Risk
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>City</Label>
              <Select value={form.location_risk.city} onValueChange={handleCityChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CITIES.map(c => <SelectItem key={c.label} value={c.label}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Crime Rate Score (0–1)</Label>
              <Input type="number" min={0} max={1} step={0.05}
                value={form.location_risk.crime_rate_score}
                onChange={e => setLocation('crime_rate_score', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Flood Risk Score (0–1)</Label>
              <Input type="number" min={0} max={1} step={0.05}
                value={form.location_risk.flood_risk_score}
                onChange={e => setLocation('flood_risk_score', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Weather Risk Score (0–1)</Label>
              <Input type="number" min={0} max={1} step={0.05}
                value={form.location_risk.weather_risk_score}
                onChange={e => setLocation('weather_risk_score', parseFloat(e.target.value))} />
            </div>
            <div className="flex items-center gap-3 col-span-full">
              <Switch checked={form.location_risk.accident_prone_area}
                onCheckedChange={v => setLocation('accident_prone_area', v)} />
              <Label>Accident-prone area</Label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Policy & Coverage ─────────────────────────────────────── */}
      {step === 3 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Shield className="w-5 h-5" /> Policy & Coverage
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sum Insured — KEY input from prototype */}
            <div className="space-y-1 col-span-full">
              <Label className="flex items-center gap-2">
                Sum Insured (USD) <span className="text-red-500">*</span>
                <Info className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs text-gray-400 font-normal">Base premium = 4% of this value</span>
              </Label>
              <Input type="number" min={0} step={100} placeholder="e.g. 20000"
                value={form.policy_details.sum_insured_usd}
                onChange={e => setPolicy('sum_insured_usd', parseFloat(e.target.value) || '')} />
              {form.policy_details.sum_insured_usd > 0 && (
                <p className="text-xs text-blue-700">
                  Base premium ≈ <strong>${(form.policy_details.sum_insured_usd * 0.04).toFixed(2)}</strong> (before risk and coverage adjustments)
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Coverage Type</Label>
              <Select value={form.policy_details.coverage_type}
                onValueChange={v => setPolicy('coverage_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="third_party">Third Party Only</SelectItem>
                  <SelectItem value="third_party_fire_theft">Third Party, Fire & Theft</SelectItem>
                  <SelectItem value="comprehensive">Comprehensive</SelectItem>
                  <SelectItem value="full_comprehensive">Full Comprehensive+</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Payment frequency — from prototype */}
            <div className="space-y-1">
              <Label>Payment Frequency</Label>
              <Select value={form.policy_details.payment_frequency}
                onValueChange={v => setPolicy('payment_frequency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="termly">Termly (× 3 / year)</SelectItem>
                  <SelectItem value="quarterly">Quarterly (× 4 / year)</SelectItem>
                  <SelectItem value="annually">Annually</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Deductible (USD)</Label>
              <Input type="number" min={100} max={5000} step={50}
                value={form.policy_details.deductible_usd}
                onChange={e => setPolicy('deductible_usd', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Policy Duration (months)</Label>
              <Select value={String(form.policy_details.policy_duration_months)}
                onValueChange={v => setPolicy('policy_duration_months', parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 months</SelectItem>
                  <SelectItem value="6">6 months</SelectItem>
                  <SelectItem value="12">12 months (Annual)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Prev. Policy Lapse (months)</Label>
              <Input type="number" min={0} max={24}
                value={form.policy_details.previous_policy_lapse_months}
                onChange={e => setPolicy('previous_policy_lapse_months', parseInt(e.target.value))} />
            </div>
            <div className="flex items-center gap-3 col-span-full">
              <Switch checked={form.policy_details.has_previous_insurance}
                onCheckedChange={v => setPolicy('has_previous_insurance', v)} />
              <Label>Has previous insurance history</Label>
            </div>
            {form.policy_details.has_previous_insurance && (
              <div className="space-y-1">
                <Label>Previous Insurer</Label>
                <Input placeholder="e.g. ZIMNAT, RM Insurance..."
                  value={form.policy_details.previous_insurer}
                  onChange={e => setPolicy('previous_insurer', e.target.value)} />
              </div>
            )}
            <div className="col-span-full space-y-1">
              <Label>Notes</Label>
              <Input placeholder="Additional underwriting notes..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 4: Results ───────────────────────────────────────────────── */}
      {step === 4 && result && (
        <div className="space-y-4">
          {/* Risk score (prototype style: 0–100 with colour bar) */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 font-semibold text-gray-600 text-sm">
                  <Shield className="w-4 h-4" style={{ color: riskBarColor }} />
                  RISK SCORE
                </div>
                <span className="text-xl font-extrabold" style={{ color: riskBarColor }}>
                  {riskScore.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-3 rounded-full transition-all duration-500"
                  style={{ width: `${riskScore}%`, background: riskBarColor }}
                />
              </div>
              <p className="mt-2 text-xs font-bold uppercase tracking-widest" style={{ color: riskBarColor }}>
                {riskLevel.replace('_', ' ')}
              </p>
            </CardContent>
          </Card>

          {/* Premium headline */}
          <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-900 to-blue-700 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-200 text-xs uppercase tracking-wider">
                    Estimated Premium &nbsp;·&nbsp;
                    <span className="capitalize">{result.installment_label}</span>
                  </p>
                  <p className="text-5xl font-bold mt-1">
                    ${result.payable_premium?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-blue-200 text-sm mt-2">
                    {result.installment_label !== 'annually' && (
                      <>Annual: <strong className="text-white">${result.recommended_premium_usd?.toFixed(2)}</strong> &nbsp;·&nbsp;</>
                    )}
                    Monthly: <strong className="text-white">${result.premium_breakdown?.monthly_premium?.toFixed(2)}</strong>
                  </p>
                </div>
                <div className="text-right text-xs text-blue-200 space-y-1">
                  <p>Sum Insured</p>
                  <p className="text-white font-semibold text-sm">
                    ${result.premium_breakdown?.sum_insured?.toLocaleString()}
                  </p>
                  <p className="mt-2">Model</p>
                  <p className="text-white font-mono text-xs">DL→feat→GB</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Model predictions */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-600" /> Hybrid Model Predictions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">MLP Deep Feature</span>
                  <Badge variant="outline" className="font-mono">{result.deep_feature?.toFixed(4)}</Badge>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">GBR (on features + deep)</span>
                  <Badge variant="outline" className="font-mono">{result.gb_prediction?.toFixed(4)}</Badge>
                </div>
                <Separator />
                <div className="flex justify-between items-center font-semibold text-sm">
                  <span>Risk Score (0–1)</span>
                  <Badge className="bg-blue-900 font-mono">{result.ensemble_risk_score?.toFixed(4)}</Badge>
                </div>
                <div className="text-xs text-gray-400 bg-gray-50 p-2 rounded">
                  Architecture: MLP→deep_feature→GBR (true stacking, HIT800 prototype)
                </div>
              </CardContent>
            </Card>

            {/* Premium breakdown (prototype style) */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600" /> Premium Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {(() => {
                  const pb = result.premium_breakdown || {};
                  return [
                    { label: 'Base Policy (4% × insured)', val:  pb.base_premium                                          ?? 0 },
                    { label: 'Risk Loading',               val:  pb.risk_adjustment    ?? pb.risk_loading                  ?? 0 },
                    { label: 'Coverage Loading',           val:  pb.coverage_loading                                       ?? 0 },
                    { label: 'Experience Credit',          val: -(pb.age_experience_discount                               ?? 0) },
                    { label: 'Safe Behaviour',             val: -(pb.safe_behaviour_discount                               ?? 0) },
                    { label: 'Anti-theft Discount',        val: -(pb.anti_theft_discount                                   ?? 0) },
                    { label: 'NCB Discount',               val: -(pb.ncb_discount                                         ?? 0) },
                    { label: 'Deductible Discount',        val: -(pb.deductible_discount                                   ?? 0) },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between text-sm">
                      <span className={r.val < 0 ? 'text-green-700' : 'text-gray-600'}>{r.label}</span>
                      <span className={`font-mono font-medium ${r.val < 0 ? 'text-green-700' : 'text-gray-800'}`}>
                        {r.val >= 0 ? '+' : ''}${Math.abs(r.val).toFixed(2)}
                      </span>
                    </div>
                  ));
                })()}
                <Separator />
                <div className="flex justify-between font-bold text-blue-900 text-sm">
                  <span>Total Annual</span>
                  <span className="font-mono">${result.recommended_premium_usd?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-blue-700 text-sm">
                  <span>{result.installment_label}</span>
                  <span className="font-mono">${result.payable_premium?.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Risk dimensions */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Risk Dimensions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: 'Age Risk',          val: result.risk_breakdown?.age_risk },
                  { label: 'Driving History',   val: result.risk_breakdown?.driving_history_risk },
                  { label: 'Vehicle Risk',      val: result.risk_breakdown?.vehicle_risk },
                  { label: 'Location Risk',     val: result.risk_breakdown?.location_risk },
                  { label: 'Behavioural Risk',  val: result.risk_breakdown?.behavioral_risk },
                ].map(r => (
                  <div key={r.label} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-28">{r.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min((r.val || 0) * 100, 100)}%`,
                          background: (r.val || 0) > 0.6 ? '#ef4444' : (r.val || 0) > 0.35 ? '#f97316' : '#22c55e',
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono text-gray-700 w-10 text-right">
                      {((r.val || 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Risk factors */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" /> Risk Factors
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.risk_breakdown?.risk_factors?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-red-600 mb-1">Risk Drivers</p>
                    {result.risk_breakdown.risk_factors.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-700 mb-1">
                        <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />{f}
                      </div>
                    ))}
                  </div>
                )}
                {result.risk_breakdown?.protective_factors?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-green-600 mb-1">Protective Factors</p>
                    {result.risk_breakdown.protective_factors.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-700 mb-1">
                        <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />{f}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* How it works (from prototype) */}
          <Card className="border-0 shadow-sm bg-slate-50">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="bg-blue-100 p-2 rounded-lg flex-shrink-0">
                <Info className="w-4 h-4 text-blue-700" />
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                <strong className="text-gray-800">How it works:</strong> The hybrid framework uses{' '}
                <strong>Deep Learning (MLP)</strong> to extract a behavioural risk fingerprint from telematics data.
                That fingerprint is appended to the original features and fed into a{' '}
                <strong>Gradient Boosting</strong> model for precise risk scoring.
                Premium = <strong>4% × Sum Insured</strong> adjusted by risk, coverage, and discounts.
              </p>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleReset} className="flex-1">New Quote</Button>
            <Button className="flex-1 bg-blue-900 hover:bg-blue-800" onClick={onQuoteCreated}>
              View All Quotes
            </Button>
          </div>
        </div>
      )}

      {/* Navigation */}
      {step < 4 && (
        <div className="flex gap-3">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(s => s - 1)} className="flex-1">
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>
          )}
          {step < 3 ? (
            <Button className="flex-1 bg-blue-900 hover:bg-blue-800"
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}>
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button className="flex-1 bg-blue-900 hover:bg-blue-800"
              onClick={handleCalculate}
              disabled={loading || !form.policy_details.sum_insured_usd}>
              <Calculator className="w-4 h-4 mr-2" />
              {loading ? 'Calculating...' : 'Calculate Premium'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
