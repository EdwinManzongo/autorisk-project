import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Car, Plus, Search } from 'lucide-react';
import { parseApiError } from '@/lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('ar_token')}` });

const SAFETY_OPTIONS = ['ABS', 'airbags', 'ESP', 'lane_assist', 'collision_warning', 'backup_camera', 'adaptive_cruise', 'blind_spot', 'automatic_braking'];

const EMPTY = {
  customer_id: '', registration_number: '', make: '', model: '', year: new Date().getFullYear(),
  engine_size_cc: 1600, vehicle_value_usd: 10000, color: '', chassis_number: '',
  engine_number: '', engine_type: 'petrol', usage_type: 'personal', annual_mileage_km: 15000,
  safety_features: [], modifications: '', garage_kept: true, financed: false, anti_theft: false,
};

export default function VehicleManagement() {
  const [vehicles, setVehicles] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);

  const loadAllVehicles = async () => {
    const cRes = await axios.get(`${API}/customers`, { headers: headers() });
    setCustomers(cRes.data);
    const allVehicles = [];
    for (const c of cRes.data.slice(0, 50)) {
      const vRes = await axios.get(`${API}/vehicles/customer/${c.id}`, { headers: headers() });
      vRes.data.forEach(v => { v._customer = c; });
      allVehicles.push(...vRes.data);
    }
    setVehicles(allVehicles);
  };

  useEffect(() => { loadAllVehicles(); }, []);

  const filtered = vehicles.filter(v =>
    !search || [v.make, v.model, v.registration_number, v._customer?.first_name, v._customer?.last_name]
      .some(f => f?.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleSafety = (feat) => {
    setForm(f => ({
      ...f,
      safety_features: f.safety_features.includes(feat)
        ? f.safety_features.filter(x => x !== feat)
        : [...f.safety_features, feat],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/vehicles`, form, { headers: headers() });
      toast.success('Vehicle added');
      setOpen(false);
      setForm(EMPTY);
      loadAllVehicles();
    } catch (err) {
      toast.error(parseApiError(err, 'Failed to add vehicle'));
    } finally {
      setLoading(false);
    }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search vehicles..." className="pl-9 w-72" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Badge variant="secondary">{filtered.length} vehicles</Badge>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-900 hover:bg-blue-800">
              <Plus className="w-4 h-4 mr-2" /> Add Vehicle
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Car className="w-5 h-5 text-blue-900" /> Register Vehicle
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 mt-2">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Customer *</Label>
                <Select value={form.customer_id} onValueChange={v => set('customer_id', v)} required>
                  <SelectTrigger><SelectValue placeholder="Select customer..." /></SelectTrigger>
                  <SelectContent>
                    {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {[
                { k: 'registration_number', label: 'Reg. Number', req: true },
                { k: 'make', label: 'Make', req: true },
                { k: 'model', label: 'Model', req: true },
                { k: 'year', label: 'Year', type: 'number', req: true },
                { k: 'engine_size_cc', label: 'Engine Size (cc)', type: 'number' },
                { k: 'vehicle_value_usd', label: 'Vehicle Value (USD)', type: 'number' },
                { k: 'color', label: 'Color' },
                { k: 'chassis_number', label: 'Chassis Number' },
                { k: 'engine_number', label: 'Engine Number' },
                { k: 'annual_mileage_km', label: 'Annual Mileage (km)', type: 'number' },
              ].map(f => (
                <div key={f.k} className="space-y-1">
                  <Label className="text-xs">{f.label}</Label>
                  <Input type={f.type || 'text'} required={f.req}
                    value={form[f.k]} onChange={e => set(f.k, f.type === 'number' ? Number(e.target.value) : e.target.value)} />
                </div>
              ))}
              <div className="space-y-1">
                <Label className="text-xs">Engine Type</Label>
                <Select value={form.engine_type} onValueChange={v => set('engine_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="petrol">Petrol</SelectItem>
                    <SelectItem value="diesel">Diesel</SelectItem>
                    <SelectItem value="ev">Electric (EV)</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                    <SelectItem value="cng">CNG</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Usage Type</Label>
                <Select value={form.usage_type} onValueChange={v => set('usage_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="commute">Commute</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-2">
                <Label className="text-xs">Safety Features</Label>
                <div className="flex flex-wrap gap-2">
                  {SAFETY_OPTIONS.map(feat => (
                    <button key={feat} type="button"
                      onClick={() => toggleSafety(feat)}
                      className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                        form.safety_features.includes(feat)
                          ? 'bg-blue-900 text-white border-blue-900'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                      }`}>{feat}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.garage_kept} onCheckedChange={v => set('garage_kept', v)} />
                <Label className="text-xs">Garage Kept</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.financed} onCheckedChange={v => set('financed', v)} />
                <Label className="text-xs">Vehicle Financed</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.anti_theft} onCheckedChange={v => set('anti_theft', v)} />
                <Label className="text-xs">Anti-theft System</Label>
              </div>
              <div className="col-span-2 flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 bg-blue-900 hover:bg-blue-800" disabled={loading}>
                  {loading ? 'Saving...' : 'Register Vehicle'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(v => (
          <Card key={v.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Car className="w-6 h-6 text-indigo-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{v.year} {v.make} {v.model}</p>
                  <p className="text-xs font-mono text-indigo-700">{v.registration_number}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{v._customer?.first_name} {v._customer?.last_name}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <Badge variant="outline" className="text-xs">${v.vehicle_value_usd?.toLocaleString()}</Badge>
                    <Badge variant="outline" className="text-xs capitalize">{v.usage_type}</Badge>
                    <Badge variant="outline" className="text-xs">{v.engine_size_cc}cc</Badge>
                  </div>
                  {v.safety_features?.length > 0 && (
                    <p className="text-xs text-green-600 mt-1">{v.safety_features.length} safety features</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!filtered.length && (
          <div className="col-span-3 flex flex-col items-center justify-center py-16 text-gray-400">
            <Car className="w-12 h-12 mb-3" />
            <p>No vehicles found</p>
          </div>
        )}
      </div>
    </div>
  );
}
