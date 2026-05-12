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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import {
  ClipboardList, CheckCircle, XCircle, AlertTriangle, Brain, DollarSign,
  Trash2, RefreshCw, ChevronDown, Users,
} from 'lucide-react';
import { parseApiError } from '@/lib/utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('ar_token')}` });

const STATUS_STYLES = {
  pending:  'bg-yellow-100 text-yellow-800',
  accepted: 'bg-green-100  text-green-800',
  rejected: 'bg-red-100    text-red-700',
  expired:  'bg-gray-100   text-gray-600',
};
const RISK_COLORS = {
  low:       'bg-green-100  text-green-800',
  medium:    'bg-yellow-100 text-yellow-800',
  high:      'bg-orange-100 text-orange-800',
  very_high: 'bg-red-100    text-red-800',
};

const EMPTY_EDIT = {
  sum_insured_usd: '',
  coverage_type: 'comprehensive',
  payment_frequency: 'monthly',
  deductible_usd: 500,
  no_claims_years: 0,
  accidents_last_5_years: 0,
  at_fault_accidents: 0,
  traffic_violations_last_3_years: 0,
  dui_convictions: 0,
  claims_last_5_years: 0,
  avg_monthly_mileage_km: 800,
  hard_braking_events_monthly: 0,
  speeding_incidents_monthly: 0,
  night_driving_pct: 10,
  notes: '',
};

export default function QuoteHistory() {
  const [quotes, setQuotes]           = useState([]);
  const [customers, setCustomers]     = useState({});
  const [allCustomers, setAllCustomers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');

  // Dialogs
  const [selected, setSelected]         = useState(null);    // view detail
  const [editTarget, setEditTarget]     = useState(null);    // quote being updated
  const [editForm, setEditForm]         = useState(EMPTY_EDIT);
  const [editLoading, setEditLoading]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);    // single delete confirm
  const [clearMode, setClearMode]       = useState(null);    // bulk clear confirm: {scope, label}

  // ── Data loading ──────────────────────────────────────────────────────────
  const load = async () => {
    const params = {};
    if (statusFilter !== 'all')   params.status      = statusFilter;
    if (customerFilter !== 'all') params.customer_id = customerFilter;
    const res = await axios.get(`${API}/quotes`, { headers: headers(), params });
    setQuotes(res.data);

    // Load customer names for display
    const ids = [...new Set(res.data.map(q => q.customer_id))];
    const map = { ...customers };
    await Promise.all(ids.filter(id => !map[id]).map(async id => {
      try { const r = await axios.get(`${API}/customers/${id}`, { headers: headers() }); map[id] = r.data; }
      catch {}
    }));
    setCustomers(map);
  };

  useEffect(() => {
    axios.get(`${API}/customers`, { headers: headers() }).then(r => setAllCustomers(r.data)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [statusFilter, customerFilter]);

  // ── Duplicate detection ───────────────────────────────────────────────────
  const pendingByCustomer = quotes.reduce((acc, q) => {
    if (q.status === 'pending') {
      acc[q.customer_id] = (acc[q.customer_id] || 0) + 1;
    }
    return acc;
  }, {});

  // ── Status actions ────────────────────────────────────────────────────────
  const handleAccept = async (id) => {
    await axios.put(`${API}/quotes/${id}/accept`, {}, { headers: headers() });
    toast.success('Quote accepted');
    load(); setSelected(null);
  };
  const handleReject = async (id) => {
    await axios.put(`${API}/quotes/${id}/reject`, {}, { headers: headers() });
    toast.success('Quote rejected');
    load(); setSelected(null);
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await axios.delete(`${API}/quotes/${deleteTarget}`, { headers: headers() });
      toast.success('Quote deleted');
      if (selected?.id === deleteTarget) setSelected(null);
    } catch { toast.error('Delete failed'); }
    setDeleteTarget(null);
    load();
  };

  // ── Bulk clear ────────────────────────────────────────────────────────────
  const confirmClear = async () => {
    if (!clearMode) return;
    try {
      const params = {};
      if (clearMode.scope === 'pending')  params.status      = 'pending';
      if (clearMode.scope === 'customer') params.customer_id = customerFilter !== 'all' ? customerFilter : undefined;
      if (clearMode.scope === 'rejected') params.status      = 'rejected';
      const res = await axios.delete(`${API}/quotes`, { headers: headers(), params });
      toast.success(res.data.message);
      load();
    } catch { toast.error('Clear failed'); }
    setClearMode(null);
  };

  // ── Open update dialog ────────────────────────────────────────────────────
  const openEdit = (q) => {
    const dh = q.driving_history || {};
    const pd = q.policy_details  || {};
    setEditForm({
      sum_insured_usd:                pd.sum_insured_usd    ?? '',
      coverage_type:                  pd.coverage_type      ?? 'comprehensive',
      payment_frequency:              pd.payment_frequency  ?? 'monthly',
      deductible_usd:                 pd.deductible_usd     ?? 500,
      no_claims_years:                pd.no_claims_years    ?? 0,
      accidents_last_5_years:         dh.accidents_last_5_years         ?? 0,
      at_fault_accidents:             dh.at_fault_accidents             ?? 0,
      traffic_violations_last_3_years:dh.traffic_violations_last_3_years ?? 0,
      dui_convictions:                dh.dui_convictions                ?? 0,
      claims_last_5_years:            dh.claims_last_5_years            ?? 0,
      avg_monthly_mileage_km:         dh.avg_monthly_mileage_km         ?? 800,
      hard_braking_events_monthly:    dh.hard_braking_events_monthly    ?? 0,
      speeding_incidents_monthly:     dh.speeding_incidents_monthly     ?? 0,
      night_driving_pct:              dh.night_driving_pct              ?? 10,
      notes: q.notes ?? '',
    });
    setEditTarget(q);
    setSelected(null);
  };

  // ── Submit recalculate ────────────────────────────────────────────────────
  const handleRecalculate = async () => {
    if (!editTarget) return;
    setEditLoading(true);
    try {
      const q = editTarget;
      const payload = {
        customer_id:  q.customer_id,
        vehicle_id:   q.vehicle_id,
        driving_history: {
          ...q.driving_history,
          accidents_last_5_years:          Number(editForm.accidents_last_5_years),
          at_fault_accidents:              Number(editForm.at_fault_accidents),
          traffic_violations_last_3_years: Number(editForm.traffic_violations_last_3_years),
          dui_convictions:                 Number(editForm.dui_convictions),
          claims_last_5_years:             Number(editForm.claims_last_5_years),
          no_claims_years:                 Number(editForm.no_claims_years),
          avg_monthly_mileage_km:          Number(editForm.avg_monthly_mileage_km),
          hard_braking_events_monthly:     Number(editForm.hard_braking_events_monthly),
          speeding_incidents_monthly:      Number(editForm.speeding_incidents_monthly),
          night_driving_pct:               Number(editForm.night_driving_pct),
        },
        location_risk:  q.location_risk,
        policy_details: {
          ...q.policy_details,
          sum_insured_usd:    Number(editForm.sum_insured_usd) || 0,
          coverage_type:      editForm.coverage_type,
          payment_frequency:  editForm.payment_frequency,
          deductible_usd:     Number(editForm.deductible_usd),
          no_claims_years:    Number(editForm.no_claims_years),
        },
        notes: editForm.notes,
      };
      const res = await axios.put(`${API}/quotes/${q.id}/recalculate`, payload, { headers: headers() });
      toast.success(`Quote ${q.quote_number} recalculated — Annual: $${res.data.recommended_premium_usd?.toFixed(2)}`);
      setEditTarget(null);
      load();
    } catch (err) {
      toast.error(parseApiError(err, 'Recalculation failed'));
    } finally {
      setEditLoading(false);
    }
  };

  const ef = (k, v) => setEditForm(f => ({ ...f, [k]: v }));

  // ── Helpers ───────────────────────────────────────────────────────────────
  const customerName = (id) => {
    const c = customers[id];
    return c ? `${c.first_name} ${c.last_name}` : '—';
  };

  return (
    <div className="space-y-4">
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>

        <Select value={customerFilter} onValueChange={setCustomerFilter}>
          <SelectTrigger className="w-52">
            <Users className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
            <SelectValue placeholder="All clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {allCustomers.map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.first_name} {c.last_name}
                {pendingByCustomer[c.id] > 1 && ` ⚠ ${pendingByCustomer[c.id]} pending`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Badge variant="secondary">{quotes.length} quote{quotes.length !== 1 ? 's' : ''}</Badge>

        {/* Clear dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto gap-1.5 border-red-200 text-red-600 hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" /> Clear <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem
              className="text-amber-700 focus:text-amber-700"
              onClick={() => setClearMode({ scope: 'pending', label: 'all pending quotes' })}
            >
              Clear pending quotes
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-gray-600 focus:text-gray-600"
              onClick={() => setClearMode({ scope: 'rejected', label: 'all rejected quotes' })}
            >
              Clear rejected quotes
            </DropdownMenuItem>
            {customerFilter !== 'all' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onClick={() => setClearMode({ scope: 'customer', label: `all quotes for ${customerName(customerFilter)}` })}
                >
                  Clear all for this client
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-700 font-semibold focus:text-red-700"
              onClick={() => setClearMode({ scope: 'all', label: 'ALL quotes in the system' })}
            >
              Clear all quotes
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Duplicate warning ─────────────────────────────────────────────── */}
      {Object.entries(pendingByCustomer).some(([, n]) => n > 1) && customerFilter === 'all' && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
          <p>
            Some clients have <strong>multiple pending quotes</strong>.
            Filter by client and use <strong>Update</strong> to recalculate instead of creating new ones.
          </p>
        </div>
      )}

      {/* ── Quote list ────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {quotes.map(q => {
          const isDuplicate = pendingByCustomer[q.customer_id] > 1 && q.status === 'pending';
          return (
            <Card
              key={q.id}
              className={`border-0 shadow-sm hover:shadow-md transition-shadow ${isDuplicate ? 'border-l-4 border-l-amber-400' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  {/* Left: info */}
                  <div
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                    onClick={() => setSelected(q)}
                  >
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <ClipboardList className="w-5 h-5 text-blue-700" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 truncate">{customerName(q.customer_id)}</p>
                        {isDuplicate && (
                          <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200 whitespace-nowrap">
                            duplicate
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-mono text-blue-700">{q.quote_number}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(q.created_at).toLocaleDateString()} · {q.policy_details?.coverage_type?.replace(/_/g,' ')}
                        {q.policy_details?.payment_frequency && ` · ${q.policy_details.payment_frequency}`}
                      </p>
                    </div>
                  </div>

                  {/* Right: premium + badges + actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="font-bold text-blue-900 text-base">${q.recommended_premium_usd?.toFixed(2)}</p>
                      <p className="text-xs text-gray-400">annual</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium hidden md:inline ${RISK_COLORS[q.risk_breakdown?.risk_level]}`}>
                      {q.risk_breakdown?.risk_level?.replace('_',' ')}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[q.status]}`}>
                      {q.status}
                    </span>

                    {/* Update button (pending only) */}
                    {q.status === 'pending' && (
                      <Button
                        size="sm" variant="outline"
                        className="text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                        onClick={e => { e.stopPropagation(); openEdit(q); }}
                      >
                        <RefreshCw className="w-3 h-3" /> Update
                      </Button>
                    )}

                    {/* Delete button */}
                    <button
                      className="p-1.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete quote"
                      onClick={e => { e.stopPropagation(); setDeleteTarget(q.id); }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {!quotes.length && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <ClipboardList className="w-12 h-12 mb-3" />
            <p>No quotes found</p>
          </div>
        )}
      </div>

      {/* ── View detail dialog ────────────────────────────────────────────── */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        {selected && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-blue-900">
                <ClipboardList className="w-5 h-5" /> {selected.quote_number}
                <span className="text-sm font-normal text-gray-500 ml-1">
                  — {customerName(selected.customer_id)}
                </span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-blue-900 text-white rounded-lg p-4 flex justify-between items-center">
                <div>
                  <p className="text-blue-200 text-xs uppercase tracking-wider">
                    Estimated Premium
                    {selected.installment_label && <span className="normal-case"> · {selected.installment_label}</span>}
                  </p>
                  <p className="text-3xl font-bold">
                    ${(selected.payable_premium ?? selected.recommended_premium_usd)?.toFixed(2)}
                  </p>
                  <div className="flex gap-3 mt-1 text-xs text-blue-200">
                    <span>Annual: <strong className="text-white">${selected.recommended_premium_usd?.toFixed(2)}</strong></span>
                    <span>Monthly: <strong className="text-white">${selected.premium_breakdown?.monthly_premium?.toFixed(2)}</strong></span>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-sm px-2 py-1 rounded-full font-medium ${RISK_COLORS[selected.risk_breakdown?.risk_level]}`}>
                    {selected.risk_breakdown?.risk_level?.replace('_',' ').toUpperCase()}
                  </span>
                  <p className="text-blue-200 text-xs mt-2">
                    Risk Score: {selected.risk_breakdown?.overall_risk_score?.toFixed(3)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Card className="border shadow-none">
                  <CardContent className="p-3">
                    <p className="text-xs font-semibold text-purple-700 mb-2 flex items-center gap-1">
                      <Brain className="w-3 h-3" /> Model Predictions
                    </p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span>Gradient Boosting</span><span className="font-mono">{selected.gb_prediction?.toFixed(4)}</span></div>
                      <div className="flex justify-between"><span>Deep Learning</span><span className="font-mono">{selected.dl_prediction?.toFixed(4)}</span></div>
                      <Separator className="my-1" />
                      <div className="flex justify-between font-semibold"><span>Ensemble</span><span className="font-mono">{selected.ensemble_risk_score?.toFixed(4)}</span></div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border shadow-none">
                  <CardContent className="p-3">
                    <p className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1">
                      <DollarSign className="w-3 h-3" /> Premium Components
                    </p>
                    {(() => {
                      const pb = selected.premium_breakdown || {};
                      const riskVal  = pb.risk_adjustment ?? pb.risk_loading ?? 0;
                      const totalDisc = (pb.age_experience_discount || 0) + (pb.safe_behaviour_discount || 0)
                                      + (pb.anti_theft_discount || 0) + (pb.ncb_discount || 0)
                                      + (pb.deductible_discount || 0) + (pb.telematics_discount || 0);
                      return (
                        <div className="space-y-1.5 text-xs">
                          {[
                            { label: 'Base Policy', val: pb.base_premium ?? 0, green: false },
                            { label: 'Risk Loading', val: riskVal,             green: false },
                            { label: 'Coverage',     val: pb.coverage_loading ?? 0, green: false },
                            { label: 'Discounts',    val: totalDisc,           green: true  },
                          ].map(r => (
                            <div key={r.label} className={`flex justify-between ${r.green ? 'text-green-700' : ''}`}>
                              <span>{r.label}</span>
                              <span className="font-mono">{r.green ? '-' : '+'}${r.val.toFixed(2)}</span>
                            </div>
                          ))}
                          <Separator className="my-1" />
                          <div className="flex justify-between font-semibold text-blue-900">
                            <span>Annual Total</span>
                            <span className="font-mono">${(pb.total_annual_premium ?? selected.recommended_premium_usd ?? 0).toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>

              {selected.risk_breakdown?.risk_factors?.length > 0 && (
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-red-700 mb-2">Risk Drivers</p>
                  {selected.risk_breakdown.risk_factors.map((f, i) => (
                    <div key={i} className="flex items-center gap-1 text-xs text-gray-700 mb-1">
                      <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />{f}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                {selected.status === 'pending' && (
                  <>
                    <Button className="flex-1 bg-green-700 hover:bg-green-600" onClick={() => handleAccept(selected.id)}>
                      <CheckCircle className="w-4 h-4 mr-2" /> Accept
                    </Button>
                    <Button variant="outline" className="flex-1 border-red-300 text-red-600 hover:bg-red-50" onClick={() => handleReject(selected.id)}>
                      <XCircle className="w-4 h-4 mr-2" /> Reject
                    </Button>
                    <Button variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50"
                      onClick={() => openEdit(selected)}>
                      <RefreshCw className="w-4 h-4 mr-2" /> Update
                    </Button>
                  </>
                )}
                <Button variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => { setDeleteTarget(selected.id); setSelected(null); }}>
                  <Trash2 className="w-4 h-4 mr-1" /> Delete
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* ── Update / Recalculate dialog ───────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={() => setEditTarget(null)}>
        {editTarget && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-blue-900">
                <RefreshCw className="w-5 h-5" /> Update Quote — {editTarget.quote_number}
              </DialogTitle>
              <p className="text-xs text-gray-500 mt-1">
                Modify inputs and recalculate. The existing quote is updated in place — no duplicate created.
              </p>
            </DialogHeader>

            <div className="space-y-5 mt-2">
              {/* Policy details */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Policy Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Sum Insured (USD) <span className="text-red-500">*</span></Label>
                    <Input type="number" min={0} step={100}
                      value={editForm.sum_insured_usd}
                      onChange={e => ef('sum_insured_usd', e.target.value)} />
                    {editForm.sum_insured_usd > 0 && (
                      <p className="text-xs text-blue-600">Base ≈ ${(editForm.sum_insured_usd * 0.04).toFixed(2)}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Coverage Type</Label>
                    <Select value={editForm.coverage_type} onValueChange={v => ef('coverage_type', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="third_party">Third Party Only</SelectItem>
                        <SelectItem value="third_party_fire_theft">Third Party, Fire & Theft</SelectItem>
                        <SelectItem value="comprehensive">Comprehensive</SelectItem>
                        <SelectItem value="full_comprehensive">Full Comprehensive+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Payment Frequency</Label>
                    <Select value={editForm.payment_frequency} onValueChange={v => ef('payment_frequency', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="termly">Termly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="annually">Annually</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Deductible (USD)</Label>
                    <Input type="number" min={100} max={5000}
                      value={editForm.deductible_usd}
                      onChange={e => ef('deductible_usd', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">No-claims Bonus Years</Label>
                    <Input type="number" min={0} max={15}
                      value={editForm.no_claims_years}
                      onChange={e => ef('no_claims_years', e.target.value)} />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Driving history */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Driving History</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { k: 'accidents_last_5_years',          label: 'Accidents (5 yrs)', max: 10 },
                    { k: 'at_fault_accidents',              label: 'At-fault',          max: 5  },
                    { k: 'traffic_violations_last_3_years', label: 'Violations (3 yrs)',max: 10 },
                    { k: 'dui_convictions',                 label: 'DUI/DWI',           max: 3  },
                    { k: 'claims_last_5_years',             label: 'Claims (5 yrs)',    max: 8  },
                  ].map(f => (
                    <div key={f.k} className="space-y-1">
                      <Label className="text-xs">{f.label}</Label>
                      <Input type="number" min={0} max={f.max}
                        value={editForm[f.k]}
                        onChange={e => ef(f.k, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Telematics */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Telematics / Behavioural</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { k: 'avg_monthly_mileage_km',       label: 'Avg Monthly Mileage (km)', max: 5000 },
                    { k: 'hard_braking_events_monthly',  label: 'Hard Braking Events / mo', max: 20   },
                    { k: 'speeding_incidents_monthly',   label: 'Speeding Incidents / mo',  max: 10   },
                    { k: 'night_driving_pct',            label: 'Night Driving (%)',         max: 100  },
                  ].map(f => (
                    <div key={f.k} className="space-y-1">
                      <Label className="text-xs">{f.label}</Label>
                      <Input type="number" min={0} max={f.max}
                        value={editForm[f.k]}
                        onChange={e => ef(f.k, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-1">
                <Label className="text-xs">Notes</Label>
                <Input placeholder="Optional notes..."
                  value={editForm.notes}
                  onChange={e => ef('notes', e.target.value)} />
              </div>

              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setEditTarget(null)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-blue-900 hover:bg-blue-800 gap-2"
                  onClick={handleRecalculate}
                  disabled={editLoading || !editForm.sum_insured_usd}
                >
                  <RefreshCw className={`w-4 h-4 ${editLoading ? 'animate-spin' : ''}`} />
                  {editLoading ? 'Recalculating...' : 'Recalculate & Save'}
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* ── Single delete confirm ─────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this quote?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Bulk clear confirm ────────────────────────────────────────────── */}
      <AlertDialog open={!!clearMode} onOpenChange={() => setClearMode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear quotes?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{clearMode?.label}</strong>. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={confirmClear}>
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
