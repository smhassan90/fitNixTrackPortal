'use client';

import { useState } from 'react';
import Layout from '@/components/Layout';
import Loading from '@/components/Loading';
import { mockAttendanceStats } from '@/lib/mockData';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface AttendanceStats {
  total: number;
  present: number;
  absent: number;
  late: number;
  consecutiveAbsences: Array<{
    memberId: string;
    memberName: string;
    consecutive: number;
  }>;
}

export default function ReportsPage() {
  const [attendanceStats] = useState<AttendanceStats>(mockAttendanceStats);
  const [loading] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  if (loading) {
    return (
      <Layout>
        <Loading message="Loading reports..." />
      </Layout>
    );
  }

  const attendanceData = attendanceStats
    ? [
        { name: 'Present', value: attendanceStats.present },
        { name: 'Absent', value: attendanceStats.absent },
        { name: 'Late', value: attendanceStats.late },
      ]
    : [];

  const COLORS = ['#1ABC9C', '#E74C3C', '#F39C12'];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-dark-gray">Reports</h1>
          <div className="flex gap-4">
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="px-4 py-2 border rounded-lg"
            />
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="px-4 py-2 border rounded-lg"
            />
          </div>
        </div>

        {/* Attendance Statistics */}
        {attendanceStats && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <p className="text-gray-600 text-sm">Total Records</p>
                <p className="text-3xl font-bold text-primary mt-2">{attendanceStats.total}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <p className="text-gray-600 text-sm">Present</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{attendanceStats.present}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <p className="text-gray-600 text-sm">Absent</p>
                <p className="text-3xl font-bold text-red-600 mt-2">{attendanceStats.absent}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <p className="text-gray-600 text-sm">Late</p>
                <p className="text-3xl font-bold text-yellow-600 mt-2">{attendanceStats.late}</p>
              </div>
            </div>

            {/* Attendance Pie Chart */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold text-dark-gray mb-4">Attendance Distribution</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={attendanceData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {attendanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Consecutive Absences Alert */}
            {attendanceStats.consecutiveAbsences.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold text-dark-gray mb-4">
                  ⚠️ Members with 3+ Consecutive Absences
                </h2>
                <div className="space-y-2">
                  {attendanceStats.consecutiveAbsences.map((item) => (
                    <div
                      key={item.memberId}
                      className="flex justify-between items-center p-3 bg-red-50 rounded-lg"
                    >
                      <span className="font-medium text-dark-gray">{item.memberName}</span>
                      <span className="text-red-600 font-semibold">
                        {item.consecutive} consecutive days
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

