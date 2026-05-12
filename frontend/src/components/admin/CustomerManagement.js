import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Search, UserCircle } from 'lucide-react';
import { parseApiError } from '@/lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('ar_token')}` });

const EMPTY = {
  first_name: '', last_name: '', email: '', phone: '', date_of_birth: '',
  gender: 'male', marital_status: 'single', occupation: '',
  address: '', city: 'Harare', country: 'Zimbabwe', id_number: '',
  drivers_license_number: '', license_issue_date: '',
};

export default function CustomerManagement() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);

  const load = async (q = '') => {
    const params = q ? { search: q } : {};
    const res = await axios.get(`${API}/customers`, { headers: headers(), params });
    setCustomers(res.data);
  };

  useEffect(() => { load(); }, []);

  const handleSearch = e => {
    setSearch(e.target.value);
    load(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/customers`, form, { headers: headers() });
      toast.success('Customer created');
      setOpen(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      toast.error(parseApiError(err, 'Failed to create customer'));
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
            <Input placeholder="Search customers..." className="pl-9 w-72" value={search} onChange={handleSearch} />
          </div>
          <Badge variant="secondary">{customers.length} total</Badge>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-900 hover:bg-blue-800">
              <Plus className="w-4 h-4 mr-2" /> Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCircle className="w-5 h-5 text-blue-900" /> New Customer
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 mt-2">
              {[
                { k: 'first_name',           label: 'First Name',         req: true  },
                { k: 'last_name',            label: 'Last Name',          req: true  },
                { k: 'date_of_birth',        label: 'Date of Birth',      req: true, type: 'date' },
                { k: 'email',                label: 'Email',              type: 'email' },
                { k: 'phone',                label: 'Phone' },
                { k: 'occupation',           label: 'Occupation' },
                { k: 'id_number',            label: 'National ID' },
                { k: 'drivers_license_number', label: 'Licence Number' },
                { k: 'license_issue_date',   label: 'Licence Issue Date', type: 'date' },
                { k: 'address',              label: 'Address' },
                { k: 'city',                 label: 'City' },
              ].map(f => (
                <div key={f.k} className="space-y-1">
                  <Label className="text-xs">
                    {f.label}{f.req && <span className="text-red-500 ml-0.5">*</span>}
                  </Label>
                  <Input type={f.type || 'text'} required={!!f.req}
                    value={form[f.k]} onChange={e => set(f.k, e.target.value)} />
                </div>
              ))}
              <div className="space-y-1">
                <Label className="text-xs">Gender</Label>
                <Select value={form.gender} onValueChange={v => set('gender', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Marital Status</Label>
                <Select value={form.marital_status} onValueChange={v => set('marital_status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="married">Married</SelectItem>
                    <SelectItem value="divorced">Divorced</SelectItem>
                    <SelectItem value="widowed">Widowed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 bg-blue-900 hover:bg-blue-800" disabled={loading}>
                  {loading ? 'Saving...' : 'Create Customer'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customers.map(c => (
          <Card key={c.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <UserCircle className="w-6 h-6 text-blue-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{c.first_name} {c.last_name}</p>
                  <p className="text-xs text-blue-700 font-mono">{c.customer_number}</p>
                  {c.occupation && <p className="text-xs text-gray-500 mt-1">{c.occupation}</p>}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {c.city && <Badge variant="outline" className="text-xs">{c.city}</Badge>}
                    <Badge variant="outline" className="text-xs capitalize">{c.gender}</Badge>
                  </div>
                  {c.email && <p className="text-xs text-gray-400 mt-1 truncate">{c.email}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!customers.length && (
          <div className="col-span-3 flex flex-col items-center justify-center py-16 text-gray-400">
            <Users className="w-12 h-12 mb-3" />
            <p>No customers found</p>
          </div>
        )}
      </div>
    </div>
  );
}
