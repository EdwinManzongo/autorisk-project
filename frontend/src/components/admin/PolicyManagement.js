import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { parseApiError } from '@/lib/utils';
import {
  FileText, Plus, Shield, RefreshCw, AlertTriangle,
  CheckCircle, XCircle, CalendarRange, Brain, DollarSign,
  Car, User,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('ar_token')}` });

const STATUS_STYLES = {
  active:    'bg-green-100  text-green-800',
  expired:   'bg-gray-100   text-gray-600',
  cancelled: 'bg-red-100    text-red-700',
  suspended: 'bg-orange-100 text-orange-800',
  draft:     'bg-blue-100   text-blue-800',
};

// Return days until/since a date string (YYYY-MM-DD)
const daysFromToday = (dateStr) => {
  if (!dateStr) return null;
  const diff = Math.round((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
  return diff;
};

const addMonths = (dateStr, months) => {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
};

const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

export default function PolicyManagement() {
  const [policies, setPolicies]     = useState([]);
  const [quotes, setQuotes]         = useState([]);
  const [customers, setCustomers]   = useState({});
  const [statusFilter, setStatusFilter] = useState('all');

  // Create new policy dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    quote_id: '', customer_id: '', vehicle_id: '',
    coverage_type: 'comprehensive', annual_premium_usd: 0,
    deductible_usd: 500, start_date: '', end_date: '', notes: '',
  });
  const [createLoading, setCreateLoading]   = useState(false);
  const [activeWarning, setActiveWarning]   = useState(null); // {policy_number, end_date}

  // Detail dialog
  const [selected, setSelected]     = useState(null);   // policy object
  const [detailData, setDetailData] = useState({});     // {customer, vehicle, quote}
  const [detailLoading, setDetailLoading] = useState(false);

  // Renew dialog
  const [renewTarget, setRenewTarget] = useState(null);
  const [renewForm, setRenewForm]     = useState({ start_date: '', end_date: '', annual_premium_usd: '', notes: '' });
  const [renewLoading, setRenewLoading] = useState(false);

  // ── Data loading ──────────────────────────────────────────────────────────
  const load = async () => {
    const params = statusFilter !== 'all' ? { status: statusFilter } : {};
    const res = await axios.get(`${API}/policies`, { headers: headers(), params });
    setPolicies(res.data);
    const ids = [...new Set(res.data.map(p => p.customer_id))];
    const map = { ...customers };
    await Promise.all(ids.filter(id => !map[id]).map(async id => {
      try { const r = await axios.get(`${API}/customers/${id}`, { headers: headers() }); map[id] = r.data; } catch {}
    }));
    setCustomers(map);
  };

  useEffect(() => { load(); }, [statusFilter]);

  // ── Open detail dialog ────────────────────────────────────────────────────
  const openDetail = async (p) => {
    setSelected(p);
    setDetailData({});
    setDetailLoading(true);
    try {
      const [custRes, vehRes] = await Promise.allSettled([
        axios.get(`${API}/customers/${p.customer_id}`, { headers: headers() }),
        axios.get(`${API}/vehicles/${p.vehicle_id}`,   { headers: headers() }),
      ]);
      const quoteRes = p.quote_id
        ? await axios.get(`${API}/quotes/${p.quote_id}`, { headers: headers() }).catch(() => null)
        : null;
      setDetailData({
        customer: custRes.status === 'fulfilled' ? custRes.value.data : null,
        vehicle:  vehRes.status  === 'fulfilled' ? vehRes.value.data  : null,
        quote:    quoteRes?.data ?? null,
      });
    } catch {}
    finally { setDetailLoading(false); }
  };

  // ── Create: load accepted quotes ─────────────────────────────────────────
  const openCreate = async () => {
    const res = await axios.get(`${API}/quotes`, { headers: headers(), params: { status: 'accepted' } });
    setQuotes(res.data);
    setCreateForm({ quote_id: '', customer_id: '', vehicle_id: '', coverage_type: 'comprehensive',
                    annual_premium_usd: 0, deductible_usd: 500, start_date: '', end_date: '', notes: '' });
    setActiveWarning(null);
    setCreateOpen(true);
  };

  // ── Create: handle quote selection → check active policy ─────────────────
  const handleSelectQuote = async (qid) => {
    const q = quotes.find(x => x.id === qid);
    if (!q) return;
    setCreateForm(f => ({
      ...f,
      quote_id: qid,
      customer_id: q.customer_id,
      vehicle_id: q.vehicle_id,
      coverage_type: q.policy_details?.coverage_type || 'comprehensive',
      annual_premium_usd: q.recommended_premium_usd || 0,
      deductible_usd: q.policy_details?.deductible_usd || 500,
    }));
    setActiveWarning(null);
    try {
      const check = await axios.get(`${API}/policies/check-active`, {
        headers: headers(),
        params: { customer_id: q.customer_id, vehicle_id: q.vehicle_id },
      });
      if (check.data.has_active) {
        setActiveWarning({ policy_number: check.data.policy_number, end_date: check.data.end_date,
                           policy_id: check.data.policy_id });
      }
    } catch {}
  };

  // ── Create: submit ────────────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      await axios.post(`${API}/policies`, createForm, { headers: headers() });
      toast.success('Policy created');
      setCreateOpen(false);
      load();
    } catch (err) {
      toast.error(parseApiError(err, 'Failed to create policy'));
    } finally {
      setCreateLoading(false);
    }
  };

  // ── Renew: open dialog ────────────────────────────────────────────────────
  const openRenew = (p) => {
    const nextStart = p.end_date ? addMonths(p.end_date, 0) : tomorrow();
    // Actually start day after end date
    const startD = new Date(p.end_date || tomorrow());
    startD.setDate(startD.getDate() + 1);
    const startStr = startD.toISOString().slice(0, 10);
    const endStr   = addMonths(startStr, 12);
    setRenewForm({
      start_date:         startStr,
      end_date:           endStr,
      annual_premium_usd: p.annual_premium_usd || '',
      notes:              '',
    });
    setRenewTarget(p);
  };

  // ── Renew: submit ─────────────────────────────────────────────────────────
  const handleRenew = async () => {
    if (!renewTarget) return;
    setRenewLoading(true);
    try {
      const payload = {
        start_date:         renewForm.start_date,
        end_date:           renewForm.end_date,
        annual_premium_usd: renewForm.annual_premium_usd ? parseFloat(renewForm.annual_premium_usd) : null,
        notes:              renewForm.notes,
      };
      const res = await axios.post(`${API}/policies/${renewTarget.id}/renew`, payload, { headers: headers() });
      toast.success(`Policy renewed — new number: ${res.data.policy_number}`);
      setRenewTarget(null);
      load();
    } catch (err) {
      toast.error(parseApiError(err, 'Renewal failed'));
    } finally {
      setRenewLoading(false);
    }
  };

  // ── Status change ─────────────────────────────────────────────────────────
  const handleStatusChange = async (id, status) => {
    try {
      await axios.put(`${API}/policies/${id}`, { status }, { headers: headers() });
      toast.success(`Policy ${status}`);
      load();
    } catch (err) {
      toast.error(parseApiError(err, 'Update failed'));
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const customerName = (id) => {
    const c = customers[id];
    return c ? `${c.first_name} ${c.last_name}` : '—';
  };

  const expiryBadge = (p) => {
    if (p.status !== 'active') return null;
    const days = daysFromToday(p.end_date);
    if (days === null) return null;
    if (days < 0)   return <span className="text-xs text-red-600 font-medium">Expired {Math.abs(days)}d ago</span>;
    if (days <= 30) return <span className="text-xs text-amber-600 font-medium">Expires in {days}d</span>;
    return null;
  };

  // Check if any customer has multiple active policies (for warning banner)
  const activeByCustomer = policies.filter(p => p.status === 'active')
    .reduce((acc, p) => { acc[p.customer_id] = (acc[p.customer_id] || 0) + 1; return acc; }, {});
  const hasDuplicates = Object.values(activeByCustomer).some(n => n > 1);

  const canRenew = (p) => ['expired', 'cancelled'].includes(p.status) ||
    (p.status === 'active' && daysFromToday(p.end_date) !== null && daysFromToday(p.end_date) <= 60);

  return (
    <div className="space-y-4">
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="secondary">{policies.length} polic{policies.length !== 1 ? 'ies' : 'y'}</Badge>
        </div>
        <Button className="bg-blue-900 hover:bg-blue-800 gap-1.5" onClick={openCreate}>
          <Plus className="w-4 h-4" /> New Policy
        </Button>
      </div>

      {/* ── Duplicate active policy warning ──────────────────────────────── */}
      {hasDuplicates && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
          <p>Some clients have <strong>multiple active policies</strong> for the same vehicle. Review and cancel the older one.</p>
        </div>
      )}

      {/* ── Policy list ───────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {policies.map(p => {
          const days = daysFromToday(p.end_date);
          const expiring = p.status === 'active' && days !== null && days <= 30;
          return (
            <Card key={p.id} className={`border-0 shadow-sm ${expiring ? 'border-l-4 border-l-amber-400' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  {/* Left: identity — clickable for detail */}
                  <div className="flex items-center gap-3 min-w-0 cursor-pointer" onClick={() => openDetail(p)}>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      p.status === 'active' ? 'bg-green-50' : 'bg-gray-100'
                    }`}>
                      <Shield className={`w-5 h-5 ${p.status === 'active' ? 'text-green-700' : 'text-gray-500'}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900">{customerName(p.customer_id)}</p>
                        {p.renewed_from && (
                          <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                            renewal #{p.renewal_count}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-mono text-blue-700 hover:underline">{p.policy_number}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <CalendarRange className="w-3 h-3" />
                          {p.start_date} → {p.end_date}
                        </p>
                        {expiryBadge(p)}
                      </div>
                      {p.renewed_from && (
                        <p className="text-xs text-gray-400 italic">Renewed from {p.renewed_from}</p>
                      )}
                    </div>
                  </div>

                  {/* Right: premium + badges + actions */}
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    <div className="text-right">
                      <p className="font-bold text-blue-900 text-base">${p.annual_premium_usd?.toFixed(2)}</p>
                      <p className="text-xs text-gray-500 capitalize">{p.coverage_type?.replace(/_/g,' ')}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLES[p.status]}`}>
                      {p.status}
                    </span>

                    {/* Renew button */}
                    {canRenew(p) && (
                      <Button size="sm" variant="outline"
                        className="text-xs gap-1 border-green-300 text-green-700 hover:bg-green-50"
                        onClick={() => openRenew(p)}>
                        <RefreshCw className="w-3 h-3" /> Renew
                      </Button>
                    )}

                    {/* Cancel button */}
                    {p.status === 'active' && (
                      <Button size="sm" variant="outline"
                        className="text-xs border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => handleStatusChange(p.id, 'cancelled')}>
                        <XCircle className="w-3 h-3 mr-1" /> Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!policies.length && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <FileText className="w-12 h-12 mb-3" />
            <p>No policies found</p>
          </div>
        )}
      </div>

      {/* ── Policy detail dialog ─────────────────────────────────────────── */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        {selected && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-blue-900">
                <Shield className="w-5 h-5" />
                {selected.policy_number}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-1 ${STATUS_STYLES[selected.status]}`}>
                  {selected.status}
                </span>
              </DialogTitle>
            </DialogHeader>

            {detailLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-400">Loading details...</div>
            ) : (
              <div className="space-y-4 mt-1">

                {/* Premium headline */}
                <div className="bg-gradient-to-br from-blue-900 to-blue-700 text-white rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-200 text-xs uppercase tracking-wider">Annual Premium</p>
                      <p className="text-4xl font-bold mt-1">${selected.annual_premium_usd?.toFixed(2)}</p>
                      <p className="text-blue-200 text-xs mt-2 flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <CalendarRange className="w-3 h-3" />
                          {selected.start_date} → {selected.end_date}
                        </span>
                        <span className="capitalize">{selected.coverage_type?.replace(/_/g,' ')}</span>
                      </p>
                    </div>
                    <div className="text-right text-xs text-blue-200 space-y-1">
                      <p>Deductible</p>
                      <p className="text-white font-semibold text-sm">${selected.deductible_usd?.toFixed(2)}</p>
                      {selected.renewal_count > 0 && (
                        <>
                          <p className="mt-2">Renewal #</p>
                          <p className="text-white font-semibold text-sm">{selected.renewal_count}</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Customer */}
                  <div className="border rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <User className="w-3.5 h-3.5" /> Policyholder
                    </p>
                    {detailData.customer ? (
                      <div className="space-y-1 text-sm">
                        <p className="font-semibold text-gray-900">
                          {detailData.customer.first_name} {detailData.customer.last_name}
                        </p>
                        <p className="text-xs text-gray-500">{detailData.customer.customer_number}</p>
                        <div className="text-xs text-gray-600 space-y-0.5">
                          {detailData.customer.email && <p>{detailData.customer.email}</p>}
                          {detailData.customer.phone && <p>{detailData.customer.phone}</p>}
                          <p className="capitalize">{detailData.customer.occupation}</p>
                          <p>{detailData.customer.city}, {detailData.customer.country}</p>
                        </div>
                      </div>
                    ) : <p className="text-xs text-gray-400">Not available</p>}
                  </div>

                  {/* Vehicle */}
                  <div className="border rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <Car className="w-3.5 h-3.5" /> Insured Vehicle
                    </p>
                    {detailData.vehicle ? (
                      <div className="space-y-1 text-sm">
                        <p className="font-semibold text-gray-900">
                          {detailData.vehicle.year} {detailData.vehicle.make} {detailData.vehicle.model}
                        </p>
                        <p className="text-xs font-mono text-blue-700">{detailData.vehicle.registration_number}</p>
                        <div className="text-xs text-gray-600 space-y-0.5">
                          <p>Engine: <span className="capitalize">{detailData.vehicle.engine_type}</span> · {detailData.vehicle.engine_size_cc}cc</p>
                          <p>Value: ${detailData.vehicle.vehicle_value_usd?.toLocaleString()}</p>
                          <p>Usage: <span className="capitalize">{detailData.vehicle.usage_type}</span></p>
                          {detailData.vehicle.anti_theft && <p className="text-green-700">✓ Anti-theft fitted</p>}
                        </div>
                      </div>
                    ) : <p className="text-xs text-gray-400">Not available</p>}
                  </div>
                </div>

                {/* AI Risk + Premium breakdown from linked quote */}
                {detailData.quote && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="border rounded-lg p-3">
                      <p className="text-xs font-semibold text-purple-700 mb-2 flex items-center gap-1">
                        <Brain className="w-3.5 h-3.5" /> AI Risk Assessment
                      </p>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Risk Level</span>
                          <span className={`px-1.5 py-0.5 rounded-full font-medium text-xs ${
                            { low:'bg-green-100 text-green-800', medium:'bg-yellow-100 text-yellow-800',
                              high:'bg-orange-100 text-orange-800', very_high:'bg-red-100 text-red-800' }
                            [detailData.quote.risk_breakdown?.risk_level] ?? ''
                          }`}>
                            {detailData.quote.risk_breakdown?.risk_level?.replace('_',' ').toUpperCase()}
                          </span>
                        </div>
                        <div className="flex justify-between"><span className="text-gray-600">Risk Score</span>
                          <span className="font-mono">{detailData.quote.risk_breakdown?.overall_risk_score?.toFixed(3)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">Ensemble Score</span>
                          <span className="font-mono">{detailData.quote.ensemble_risk_score?.toFixed(4)}</span></div>
                        <Separator className="my-1" />
                        <div className="flex justify-between"><span className="text-gray-600">GB Prediction</span>
                          <span className="font-mono">{detailData.quote.gb_prediction?.toFixed(4)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-600">DL Prediction</span>
                          <span className="font-mono">{detailData.quote.dl_prediction?.toFixed(4)}</span></div>
                      </div>
                    </div>

                    <div className="border rounded-lg p-3">
                      <p className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5" /> Premium Breakdown
                      </p>
                      {(() => {
                        const pb = detailData.quote.premium_breakdown || {};
                        const riskVal   = pb.risk_adjustment ?? pb.risk_loading ?? 0;
                        const totalDisc = (pb.age_experience_discount || 0) + (pb.safe_behaviour_discount || 0)
                                        + (pb.anti_theft_discount || 0) + (pb.ncb_discount || 0)
                                        + (pb.deductible_discount || 0) + (pb.telematics_discount || 0);
                        return (
                          <div className="space-y-1.5 text-xs">
                            {[
                              { label: 'Base Policy', val: pb.base_premium ?? 0,    green: false },
                              { label: 'Risk Loading', val: riskVal,                 green: false },
                              { label: 'Coverage',     val: pb.coverage_loading ?? 0, green: false },
                              { label: 'Discounts',    val: totalDisc,               green: true  },
                            ].map(r => (
                              <div key={r.label} className={`flex justify-between ${r.green ? 'text-green-700' : ''}`}>
                                <span>{r.label}</span>
                                <span className="font-mono">{r.green ? '-' : '+'}${r.val.toFixed(2)}</span>
                              </div>
                            ))}
                            <Separator className="my-1" />
                            <div className="flex justify-between font-semibold text-blue-900">
                              <span>Annual Total</span>
                              <span className="font-mono">${(pb.total_annual_premium ?? selected.annual_premium_usd ?? 0).toFixed(2)}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Risk factors from quote */}
                {detailData.quote?.risk_breakdown?.risk_factors?.length > 0 && (
                  <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                    <p className="text-xs font-semibold text-red-700 mb-2">Risk Drivers (at time of quote)</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                      {detailData.quote.risk_breakdown.risk_factors.map((f, i) => (
                        <div key={i} className="flex items-center gap-1 text-xs text-gray-700">
                          <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />{f}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Renewal history */}
                {selected.renewed_from && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
                    <p className="font-semibold mb-1 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Renewal History
                    </p>
                    <p>This policy is renewal #{selected.renewal_count} of <strong>{selected.renewed_from}</strong>.</p>
                  </div>
                )}

                {/* Notes */}
                {selected.notes && (
                  <div className="border rounded-lg p-3 text-xs text-gray-600">
                    <p className="font-semibold text-gray-700 mb-1">Notes</p>
                    <p>{selected.notes}</p>
                  </div>
                )}

                {/* Footer actions */}
                <div className="flex gap-2 flex-wrap pt-1">
                  {canRenew(selected) && (
                    <Button className="bg-green-700 hover:bg-green-600 gap-1.5"
                      onClick={() => { setSelected(null); openRenew(selected); }}>
                      <RefreshCw className="w-4 h-4" /> Renew Policy
                    </Button>
                  )}
                  {selected.status === 'active' && (
                    <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 gap-1.5"
                      onClick={() => { handleStatusChange(selected.id, 'cancelled'); setSelected(null); }}>
                      <XCircle className="w-4 h-4" /> Cancel Policy
                    </Button>
                  )}
                  <Button variant="ghost" className="text-gray-500 ml-auto"
                    onClick={() => setSelected(null)}>
                    Close
                  </Button>
                </div>

              </div>
            )}
          </DialogContent>
        )}
      </Dialog>

      {/* ── Create new policy dialog ──────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-900">
              <Shield className="w-5 h-5" /> Create Policy from Quote
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label className="text-xs">Accepted Quote</Label>
              <Select value={createForm.quote_id} onValueChange={handleSelectQuote} required>
                <SelectTrigger><SelectValue placeholder="Select quote..." /></SelectTrigger>
                <SelectContent>
                  {quotes.map(q => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.quote_number} — ${q.recommended_premium_usd?.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!quotes.length && (
                <p className="text-xs text-amber-600">No accepted quotes found. Accept a quote first.</p>
              )}
            </div>

            {/* Active policy warning */}
            {activeWarning && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800">
                  <p className="font-semibold">Active policy exists</p>
                  <p>
                    This client already has active policy{' '}
                    <strong>{activeWarning.policy_number}</strong> expiring on{' '}
                    <strong>{activeWarning.end_date}</strong>.
                    You can still proceed, but the system will block the save.
                    Consider <em>renewing</em> the existing policy instead.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Annual Premium (USD)</Label>
                <Input type="number" min={0}
                  value={createForm.annual_premium_usd}
                  onChange={e => setCreateForm(f => ({ ...f, annual_premium_usd: parseFloat(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Deductible (USD)</Label>
                <Input type="number" min={0}
                  value={createForm.deductible_usd}
                  onChange={e => setCreateForm(f => ({ ...f, deductible_usd: parseFloat(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Start Date</Label>
                <Input type="date" required value={createForm.start_date}
                  onChange={e => setCreateForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End Date</Label>
                <Input type="date" required value={createForm.end_date}
                  onChange={e => setCreateForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Input placeholder="Optional notes..."
                value={createForm.notes}
                onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1 bg-blue-900 hover:bg-blue-800" disabled={createLoading}>
                {createLoading ? 'Creating...' : 'Create Policy'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Renew dialog ─────────────────────────────────────────────────── */}
      <Dialog open={!!renewTarget} onOpenChange={() => setRenewTarget(null)}>
        {renewTarget && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-800">
                <RefreshCw className="w-5 h-5" /> Renew Policy
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {/* Current policy summary */}
              <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Policy</span>
                  <span className="font-mono font-semibold text-blue-700">{renewTarget.policy_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Client</span>
                  <span className="font-medium">{customerName(renewTarget.customer_id)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Coverage</span>
                  <span className="capitalize">{renewTarget.coverage_type?.replace(/_/g,' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Current period</span>
                  <span>{renewTarget.start_date} → {renewTarget.end_date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Current premium</span>
                  <span className="font-semibold">${renewTarget.annual_premium_usd?.toFixed(2)}/yr</span>
                </div>
                {renewTarget.renewal_count > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Renewal #</span>
                    <span>{renewTarget.renewal_count + 1}</span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">New Start Date <span className="text-red-500">*</span></Label>
                  <Input type="date" required value={renewForm.start_date}
                    onChange={e => setRenewForm(f => ({ ...f, start_date: e.target.value,
                      end_date: addMonths(e.target.value, 12) }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">New End Date <span className="text-red-500">*</span></Label>
                  <Input type="date" required value={renewForm.end_date}
                    onChange={e => setRenewForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  Revised Premium (USD)
                  <span className="text-gray-400 font-normal ml-1">— leave blank to keep ${renewTarget.annual_premium_usd?.toFixed(2)}</span>
                </Label>
                <Input type="number" min={0} step={0.01}
                  placeholder={renewTarget.annual_premium_usd?.toFixed(2)}
                  value={renewForm.annual_premium_usd}
                  onChange={e => setRenewForm(f => ({ ...f, annual_premium_usd: e.target.value }))} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Notes</Label>
                <Input placeholder="Reason for renewal, changes, etc."
                  value={renewForm.notes}
                  onChange={e => setRenewForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              {/* What will happen */}
              <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-800 space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> What happens on renewal
                </p>
                <ul className="list-disc ml-4 space-y-0.5 text-blue-700">
                  <li>A new policy number is generated for the new period</li>
                  <li>The current policy <strong>{renewTarget.policy_number}</strong> is marked as <em>expired</em></li>
                  <li>Renewal history is recorded on the new policy</li>
                </ul>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setRenewTarget(null)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-green-700 hover:bg-green-600 gap-2"
                  onClick={handleRenew}
                  disabled={renewLoading || !renewForm.start_date || !renewForm.end_date}
                >
                  <RefreshCw className={`w-4 h-4 ${renewLoading ? 'animate-spin' : ''}`} />
                  {renewLoading ? 'Renewing...' : 'Confirm Renewal'}
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
