import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parseApiError } from '@/lib/utils';
import {
  Activity, Download, Upload, Search, Trash2, FileSpreadsheet,
  AlertCircle, CheckCircle, Info,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('ar_token')}` });

const RISK_FIELD_COLORS = (val, field) => {
  if (field === 'hard_braking_events_monthly') {
    if (val >= 10) return 'text-red-600 font-bold';
    if (val >= 5)  return 'text-amber-600 font-semibold';
    return 'text-green-700';
  }
  if (field === 'speeding_incidents_monthly') {
    if (val >= 5) return 'text-red-600 font-bold';
    if (val >= 3) return 'text-amber-600 font-semibold';
    return 'text-green-700';
  }
  if (field === 'night_driving_pct') {
    if (val >= 50) return 'text-red-600 font-bold';
    if (val >= 30) return 'text-amber-600 font-semibold';
    return 'text-green-700';
  }
  if (field === 'avg_monthly_mileage_km') {
    if (val >= 3000) return 'text-red-600 font-bold';
    if (val >= 2000) return 'text-amber-600 font-semibold';
    return 'text-green-700';
  }
  return '';
};

export default function TelematicsManagement() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [uploadResult, setUploadResult] = useState(null);
  const fileRef = useRef(null);

  const load = async (reg = '') => {
    setLoading(true);
    try {
      const params = reg ? { registration: reg } : {};
      const res = await axios.get(`${API}/telematics`, { headers: headers(), params });
      setRecords(res.data);
    } catch (err) {
      toast.error('Failed to load telematics records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (e) => {
    setSearch(e.target.value);
    load(e.target.value);
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await axios.get(`${API}/telematics/template`, {
        headers: headers(),
        responseType: 'blob',
      });
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

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Please select an .xlsx or .xls file');
      return;
    }
    setUploading(true);
    setUploadResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await axios.post(`${API}/telematics/upload`, fd, {
        headers: { ...headers(), 'Content-Type': 'multipart/form-data' },
      });
      setUploadResult(res.data);
      toast.success(`${res.data.uploaded} record(s) uploaded successfully`);
      load();
    } catch (err) {
      const msg = parseApiError(err, 'Upload failed');
      toast.error(msg);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API}/telematics/${id}`, { headers: headers() });
      toast.success('Record deleted');
      load(search);
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by registration number..."
            className="pl-9"
            value={search}
            onChange={handleSearch}
          />
        </div>

        <Button
          variant="outline"
          className="border-blue-300 text-blue-800 hover:bg-blue-50 gap-2"
          onClick={handleDownloadTemplate}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Download Template
        </Button>

        <Button
          className="bg-blue-900 hover:bg-blue-800 gap-2"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="w-4 h-4" />
          {uploading ? 'Uploading...' : 'Upload Excel'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleFileChange}
        />

        <Badge variant="secondary">{records.length} records</Badge>
      </div>

      {/* How-to banner */}
      <Card className="border-0 bg-blue-50 shadow-none">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-700 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 space-y-1">
            <p className="font-semibold">How to upload telematics data</p>
            <ol className="list-decimal ml-4 space-y-0.5 text-blue-800 text-xs">
              <li>Click <strong>Download Template</strong> to get the pre-formatted Excel file.</li>
              <li>Fill in one row per vehicle per month — delete the sample row before saving.</li>
              <li>Enter the exact <strong>Vehicle Registration</strong> number as it appears in the system so the record links automatically.</li>
              <li>Click <strong>Upload Excel</strong> and select your completed file.</li>
              <li>Uploaded records are available in the Premium Calculator to auto-fill telematics fields.</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Upload result summary */}
      {uploadResult && (
        <Card className={`border-0 shadow-sm ${uploadResult.uploaded > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <CardContent className="p-4 flex items-start gap-3">
            {uploadResult.uploaded > 0
              ? <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              : <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />}
            <div className="text-sm">
              <p className="font-semibold text-gray-800">
                {uploadResult.uploaded} record(s) uploaded successfully
              </p>
              {uploadResult.unmatched?.length > 0 && (
                <p className="text-amber-700 mt-1">
                  Could not match to vehicle in system:{' '}
                  <strong>{uploadResult.unmatched.join(', ')}</strong>
                  {' '}— check the registration number spelling.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Records table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">Loading records...</div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 space-y-3">
          <Activity className="w-14 h-14" />
          <p className="text-base">No telematics records yet</p>
          <p className="text-sm">Download the template, fill it in, and upload it to get started.</p>
          <Button
            variant="outline"
            className="mt-2 border-blue-300 text-blue-800 hover:bg-blue-50 gap-2"
            onClick={handleDownloadTemplate}
          >
            <Download className="w-4 h-4" /> Download Template
          </Button>
        </div>
      ) : (
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-900 text-white">
                  {[
                    'Registration', 'Customer', 'Period',
                    'Avg Mileage (km/mo)', 'Hard Braking', 'Speeding',
                    'Night Driving', 'Linked', 'Uploaded', '',
                  ].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r, idx) => (
                  <tr
                    key={r.id}
                    className={`border-b border-gray-100 hover:bg-blue-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
                  >
                    <td className="px-3 py-2 font-mono font-semibold text-blue-900 whitespace-nowrap">
                      {r.registration_number}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{r.customer_name || '—'}</td>
                    <td className="px-3 py-2 font-mono text-gray-700">{r.period_month}</td>
                    <td className={`px-3 py-2 text-center ${RISK_FIELD_COLORS(r.avg_monthly_mileage_km, 'avg_monthly_mileage_km')}`}>
                      {r.avg_monthly_mileage_km?.toLocaleString()}
                    </td>
                    <td className={`px-3 py-2 text-center ${RISK_FIELD_COLORS(r.hard_braking_events_monthly, 'hard_braking_events_monthly')}`}>
                      {r.hard_braking_events_monthly}
                    </td>
                    <td className={`px-3 py-2 text-center ${RISK_FIELD_COLORS(r.speeding_incidents_monthly, 'speeding_incidents_monthly')}`}>
                      {r.speeding_incidents_monthly}
                    </td>
                    <td className={`px-3 py-2 text-center ${RISK_FIELD_COLORS(r.night_driving_pct, 'night_driving_pct')}`}>
                      {r.night_driving_pct?.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.vehicle_id
                        ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                        : <AlertCircle className="w-4 h-4 text-amber-400 mx-auto" title="Not matched to a vehicle" />}
                    </td>
                    <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(r.uploaded_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                        title="Delete record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
