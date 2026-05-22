'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import { ShieldAlert, AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface Report {
  id: string;
  contentType: string;
  contentId: string;
  reason: string;
  status: 'pending' | 'approved' | 'removed';
  reportedAt?: any;
  reportedBy?: string;
}

export default function ModerationPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchReports(); }, []);

  async function fetchReports() {
    try {
      const snap = await getDocs(collection(db, 'reports'));
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Report[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const pending = reports.filter(r => r.status === 'pending').length;
  const approved = reports.filter(r => r.status === 'approved').length;
  const removed = reports.filter(r => r.status === 'removed').length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Content Moderation</h1>
        <p className="mt-1 text-sm text-gray-500">Review reported content and manage takedowns</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending', value: pending, icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Approved', value: approved, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Removed', value: removed, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{loading ? '—' : value}</p>
              </div>
              <div className={`rounded-lg p-2 ${bg}`}>
                <Icon className={`size-5 ${color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Moderation Queue</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-blue-600" />
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShieldAlert className="size-10 text-gray-300" />
            <p className="mt-3 text-sm font-medium text-gray-900">No reports</p>
            <p className="mt-1 text-xs text-gray-500">Reported content will appear here</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Content</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Reason</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map(report => (
                <tr key={report.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900 capitalize">{report.contentType}</p>
                    <p className="text-xs text-gray-500">{report.contentId}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{report.reason}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      report.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      report.status === 'approved' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {report.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">Approve</button>
                      <button className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50">Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
