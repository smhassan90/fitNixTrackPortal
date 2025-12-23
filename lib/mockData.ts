// Mock data for development without API

export const mockPackages = [
  {
    id: '1',
    name: 'Basic Package',
    price: 3000,
    duration: '1 month',
    features: ['Gym Access', 'Locker Facility'],
  },
  {
    id: '2',
    name: 'Standard Package',
    price: 5000,
    duration: '1 month',
    features: ['Gym Access', 'Locker Facility', 'Group Classes'],
  },
  {
    id: '3',
    name: 'Premium Package',
    price: 8000,
    duration: '1 month',
    features: ['Gym Access', 'Locker Facility', 'Group Classes', 'Sauna Access'],
  },
  {
    id: '4',
    name: 'Annual Basic',
    price: 30000,
    duration: '12 months',
    features: ['Gym Access', 'Locker Facility'],
  },
  {
    id: '5',
    name: 'Annual Premium',
    price: 80000,
    duration: '12 months',
    features: ['Gym Access', 'Locker Facility', 'Group Classes', 'Sauna Access'],
  },
];

export const mockUser = {
  id: '1',
  name: 'John Admin',
  email: 'admin@fitnix.com',
  role: 'GYM_ADMIN',
  gymId: 'gym-1',
  gymName: 'FitNix Elite Gym',
};

export const mockTrainers = [
  {
    id: '1',
    name: 'Mike Trainer',
    specialization: 'Strength Training',
    charges: 5000,
    _count: { members: 2 },
  },
  {
    id: '2',
    name: 'Sarah Coach',
    specialization: 'Cardio & Weight Loss',
    charges: 4500,
    _count: { members: 1 },
  },
  {
    id: '3',
    name: 'David Fitness',
    specialization: 'Bodybuilding',
    charges: 5500,
    _count: { members: 0 },
  },
];

export const mockMembers = [
  {
    id: '1',
    name: 'Alice Member',
    phone: '+1234567890',
    email: 'alice@example.com',
    membershipStart: '2024-01-01T00:00:00.000Z',
    membershipEnd: '2024-12-31T00:00:00.000Z',
    trainers: [mockTrainers[0]],
  },
  {
    id: '2',
    name: 'Bob Member',
    phone: '+1234567891',
    email: 'bob@example.com',
    membershipStart: '2024-02-01T00:00:00.000Z',
    membershipEnd: '2025-01-31T00:00:00.000Z',
    trainers: [mockTrainers[1]],
  },
  {
    id: '3',
    name: 'Charlie Member',
    phone: '+1234567892',
    email: 'charlie@example.com',
    membershipStart: '2024-03-01T00:00:00.000Z',
    membershipEnd: '2025-02-28T00:00:00.000Z',
    trainers: [],
  },
  {
    id: '4',
    name: 'Diana Member',
    phone: '+1234567893',
    email: 'diana@example.com',
    membershipStart: '2024-01-15T00:00:00.000Z',
    membershipEnd: '2024-12-15T00:00:00.000Z',
    trainers: [mockTrainers[0]],
  },
];

export const mockAttendance = [
  {
    id: '1',
    memberId: '1',
    date: new Date(Date.now() - 0 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'PRESENT' as const,
    member: {
      id: '1',
      name: 'Alice Member',
      phone: '+1234567890',
    },
  },
  {
    id: '2',
    memberId: '1',
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'PRESENT' as const,
    member: {
      id: '1',
      name: 'Alice Member',
      phone: '+1234567890',
    },
  },
  {
    id: '3',
    memberId: '2',
    date: new Date(Date.now() - 0 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'PRESENT' as const,
    member: {
      id: '2',
      name: 'Bob Member',
      phone: '+1234567891',
    },
  },
  {
    id: '4',
    memberId: '3',
    date: new Date(Date.now() - 0 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'ABSENT' as const,
    member: {
      id: '3',
      name: 'Charlie Member',
      phone: '+1234567892',
    },
  },
  {
    id: '5',
    memberId: '3',
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'ABSENT' as const,
    member: {
      id: '3',
      name: 'Charlie Member',
      phone: '+1234567892',
    },
  },
  {
    id: '6',
    memberId: '3',
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'ABSENT' as const,
    member: {
      id: '3',
      name: 'Charlie Member',
      phone: '+1234567892',
    },
  },
];

export const mockPayments = [
  {
    id: '1',
    memberId: '1',
    month: '2024-11',
    amount: 50.0,
    status: 'PAID' as const,
    dueDate: '2024-11-05T00:00:00.000Z',
    paidDate: '2024-11-03T00:00:00.000Z',
    member: {
      id: '1',
      name: 'Alice Member',
      phone: '+1234567890',
      email: 'alice@example.com',
    },
  },
  {
    id: '2',
    memberId: '1',
    month: '2024-12',
    amount: 50.0,
    status: 'PENDING' as const,
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    paidDate: null,
    member: {
      id: '1',
      name: 'Alice Member',
      phone: '+1234567890',
      email: 'alice@example.com',
    },
  },
  {
    id: '3',
    memberId: '2',
    month: '2024-11',
    amount: 50.0,
    status: 'OVERDUE' as const,
    dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    paidDate: null,
    member: {
      id: '2',
      name: 'Bob Member',
      phone: '+1234567891',
      email: 'bob@example.com',
    },
  },
  {
    id: '4',
    memberId: '3',
    month: '2024-12',
    amount: 50.0,
    status: 'PENDING' as const,
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    paidDate: null,
    member: {
      id: '3',
      name: 'Charlie Member',
      phone: '+1234567892',
      email: 'charlie@example.com',
    },
  },
];

export const mockDashboardStats = {
  totalMembers: 4,
  totalTrainers: 3,
  pendingPayments: 2,
  overduePayments: 1,
  attendanceSummary: {
    present: 45,
    absent: 12,
    late: 3,
  },
  revenueByMonth: {
    '2024-07': 200,
    '2024-08': 250,
    '2024-09': 200,
    '2024-10': 300,
    '2024-11': 250,
    '2024-12': 100,
  },
  attendanceTrend: [
    { date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], count: 12 },
    { date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], count: 15 },
    { date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], count: 18 },
    { date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], count: 14 },
    { date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], count: 16 },
    { date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], count: 13 },
    { date: new Date(Date.now()).toISOString().split('T')[0], count: 15 },
  ],
  workoutStats: 127,
};

export const mockAttendanceStats = {
  total: 60,
  present: 45,
  absent: 12,
  late: 3,
  consecutiveAbsences: [
    {
      memberId: '3',
      memberName: 'Charlie Member',
      consecutive: 3,
    },
  ],
};

