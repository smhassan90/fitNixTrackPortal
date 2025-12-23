'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { mockDashboardStats } from '@/lib/mockData';
import { colors, getGradient, getStatusColors } from '@/lib/colors';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

interface DashboardStats {
  totalMembers: number;
  totalTrainers: number;
  pendingPayments: number;
  overduePayments: number;
  attendanceSummary: {
    present: number;
    absent: number;
  };
  revenueByMonth: Record<string, number>;
  attendanceTrend: Array<{ date: string; count: number }>;
  workoutStats: number;
  currentlyInGym?: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>(mockDashboardStats);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleCardClick = (route: string, filter?: { key: string; value: string }) => {
    if (filter) {
      router.push(`${route}?${filter.key}=${filter.value}`);
    } else {
      router.push(route);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Loading dashboard...</div>
      </Layout>
    );
  }

  if (!stats) {
    return (
      <Layout>
        <div className="text-center py-12 text-red-600">Failed to load dashboard</div>
      </Layout>
    );
  }

  const revenueData = Object.entries(stats.revenueByMonth)
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const attendancePercentage = Math.round(
    (stats.attendanceSummary.present / 
     (stats.attendanceSummary.present + stats.attendanceSummary.absent)) * 100
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    // In a real app, this would fetch fresh data from the API
    setStats(mockDashboardStats);
    setRefreshing(false);
  };

  const handleViewCurrentlyInGym = () => {
    router.push('/attendance?filter=today');
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-dark-gray">Dashboard</h1>
            <p className="text-gray-500 mt-1">Welcome back! Here's what's happening today.</p>
          </div>
          <div className="text-sm text-gray-500">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Members Card */}
          <div 
            onClick={() => handleCardClick('/members')}
            className="bg-primary p-6 rounded-xl shadow-lg text-white transform hover:scale-105 transition-all duration-200 cursor-pointer hover:shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-teal-100 text-sm font-medium mb-1">Total Members</p>
                <p className="text-4xl font-bold">{stats.totalMembers}</p>
                <p className="text-teal-100 text-xs mt-2">Active members</p>
              </div>
              <div className="bg-white bg-opacity-20 p-4 rounded-full">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Trainers Card */}
          <div 
            onClick={() => handleCardClick('/trainers')}
            className="bg-blue p-6 rounded-xl shadow-lg text-white transform hover:scale-105 transition-all duration-200 cursor-pointer hover:shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium mb-1">Active Trainers</p>
                <p className="text-4xl font-bold">{stats.totalTrainers}</p>
                <p className="text-blue-100 text-xs mt-2">Available trainers</p>
              </div>
              <div className="bg-white bg-opacity-20 p-4 rounded-full">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>

          {/* Pending Payments Card */}
          <div 
            onClick={() => handleCardClick('/payments', { key: 'status', value: 'PENDING' })}
            className="bg-orange p-6 rounded-xl shadow-lg text-white transform hover:scale-105 transition-all duration-200 cursor-pointer hover:shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm font-medium mb-1">Pending Payments</p>
                <p className="text-4xl font-bold">{stats.pendingPayments}</p>
                <p className="text-orange-100 text-xs mt-2">Awaiting payment</p>
              </div>
              <div className="bg-white bg-opacity-20 p-4 rounded-full">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>

          {/* Overdue Payments Card */}
          <div 
            onClick={() => handleCardClick('/payments', { key: 'status', value: 'OVERDUE' })}
            className="bg-gradient-to-br from-error to-error-dark p-6 rounded-xl shadow-lg text-white transform hover:scale-105 transition-all duration-200 cursor-pointer hover:shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-sm font-medium mb-1">Overdue Payments</p>
                <p className="text-4xl font-bold">{stats.overduePayments}</p>
                <p className="text-red-100 text-xs mt-2">Requires attention</p>
              </div>
              <div className="bg-white bg-opacity-20 p-4 rounded-full">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attendance Trend */}
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-dark-gray">Attendance Trend</h2>
                <p className="text-sm text-gray-500">Last 7 days</p>
              </div>
              <div className="bg-primary bg-opacity-10 px-3 py-1 rounded-full">
                <span className="text-primary text-sm font-semibold">{attendancePercentage}%</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={stats.attendanceTrend}>
                <defs>
                  <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.chart.primary} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={colors.chart.primary} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: '#7f8c8d', fontSize: 12 }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis tick={{ fill: '#7f8c8d', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e0e0e0', 
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke={colors.chart.primary} 
                  strokeWidth={3}
                  fill="url(#colorAttendance)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue Chart */}
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-dark-gray">Revenue</h2>
                <p className="text-sm text-gray-500">Last 6 months</p>
              </div>
              <div className="bg-blue bg-opacity-10 px-3 py-1 rounded-full">
                <span className="text-blue text-sm font-semibold">
                  Rs. {Object.values(stats.revenueByMonth).reduce((a, b) => a + b, 0).toLocaleString()}
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.chart.secondary} stopOpacity={1}/>
                    <stop offset="95%" stopColor={colors.chart.secondary} stopOpacity={0.7}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fill: '#7f8c8d', fontSize: 12 }}
                  tickFormatter={(value) => new Date(value + '-01').toLocaleDateString('en-US', { month: 'short' })}
                />
                <YAxis tick={{ fill: '#7f8c8d', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e0e0e0', 
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                  }}
                  formatter={(value: any) => [`Rs. ${value.toLocaleString()}`, 'Revenue']}
                />
                <Bar 
                  dataKey="amount" 
                  fill="url(#colorRevenue)" 
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Attendance Summary & Workout Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attendance Summary */}
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-dark-gray">Attendance Summary</h2>
                <p className="text-sm text-gray-500 mt-1">Last 30 days</p>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 text-gray-600 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh data"
              >
                <svg 
                  className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Present and Absent Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-green-700 uppercase tracking-wide">Present</span>
                    <div className="bg-green-500 p-2 rounded-lg">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-green-800">{stats.attendanceSummary.present}</p>
                  <p className="text-xs text-green-600 mt-1">Members attended</p>
                </div>
                
                <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-red-700 uppercase tracking-wide">Absent</span>
                    <div className="bg-red-500 p-2 rounded-lg">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-red-800">{stats.attendanceSummary.absent}</p>
                  <p className="text-xs text-red-600 mt-1">Members absent</p>
                </div>
              </div>

              {/* Attendance Rate */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Attendance Rate</span>
                  <span className="text-lg font-bold text-primary">{attendancePercentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-primary h-2.5 rounded-full transition-all duration-500" 
                    style={{ width: `${attendancePercentage}%` }}
                  ></div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleViewCurrentlyInGym}
                  className="flex-1 bg-primary text-white px-4 py-3 rounded-lg hover:bg-opacity-90 transition-colors font-medium flex items-center justify-center gap-2 shadow-sm"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>People Currently in Gym</span>
                  {stats.currentlyInGym !== undefined && (
                    <span className="bg-white bg-opacity-20 px-2 py-0.5 rounded-full text-sm font-semibold">
                      {stats.currentlyInGym}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Workout Stats */}
          <div className="bg-gradient-to-br from-purple to-purple-dark p-6 rounded-xl shadow-lg text-white">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Workout Statistics</h2>
              <div className="bg-white bg-opacity-20 p-3 rounded-full">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div className="mt-6">
              <p className="text-5xl font-bold mb-2">{stats.workoutStats}</p>
              <p className="text-white text-opacity-80 text-sm">Workouts logged in last 30 days</p>
            </div>
            <div className="mt-6 pt-6 border-t border-white border-opacity-20">
              <div className="flex items-center justify-between">
                <span className="text-white text-opacity-80 text-sm">Daily Average</span>
                <span className="text-lg font-semibold">{Math.round(stats.workoutStats / 30)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

