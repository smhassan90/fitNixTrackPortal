// Shared packages data store
// In production, this would be replaced with a database

export interface PackageData {
  id: string;
  name: string;
  price: number;
  duration: string;
  features: string[];
}

export let packages: PackageData[] = [
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

