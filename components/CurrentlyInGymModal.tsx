'use client';

import Link from 'next/link';
import type { MemberInGym } from '@/lib/attendanceApi';
import { displayMemberId } from '@/lib/displayMemberId';

interface CurrentlyInGymModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: MemberInGym[];
  count: number;
  overdueCount?: number;
  autoCheckoutHours?: number;
  loading?: boolean;
}

export default function CurrentlyInGymModal({
  isOpen,
  onClose,
  members,
  count,
  overdueCount = 0,
  autoCheckoutHours = 6,
  loading = false,
}: CurrentlyInGymModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
      <div
        className="absolute inset-0 bg-black transition-opacity duration-300 opacity-50 pointer-events-auto"
        onClick={onClose}
      />

      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] relative z-10 transform transition-all duration-300 ease-out scale-100 opacity-100 translate-y-0 pointer-events-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-dark-gray">Members Currently In Gym</h2>
            <p className="text-sm text-gray-500 mt-1">
              Checked in, not signed out (within {autoCheckoutHours}h window)
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 p-2 hover:bg-gray-100 rounded-lg"
            title="Close"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-full font-semibold">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
              <span>
                Total: {count} {count === 1 ? 'Member' : 'Members'}
              </span>
            </div>
            {overdueCount > 0 && (
              <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-900 px-4 py-2 rounded-full font-semibold text-sm">
                {overdueCount} with overdue payment{overdueCount === 1 ? '' : 's'}
              </div>
            )}
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <p className="text-gray-500 mt-4">Loading members...</p>
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-gray-100 rounded-full p-6 w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <p className="text-gray-500 font-semibold text-lg mb-2">No members currently in gym</p>
              <p className="text-gray-400 text-sm">No active check-ins within the {autoCheckoutHours}h window</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-light-gray">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                      Member
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                      Check-in Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-dark-gray uppercase tracking-wider">
                      Duration
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {members.map((member) => (
                    <tr
                      key={member.memberId}
                      className={`hover:bg-gray-50 transition-colors ${
                        member.hasOverduePayment ? 'border-l-4 border-l-amber-500 bg-amber-50/40' : ''
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary bg-opacity-10 flex items-center justify-center mr-3">
                            <span className="text-primary font-semibold text-sm">
                              {member.memberName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-dark-gray">{member.memberName}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-500">ID: {displayMemberId(member)}</span>
                              {member.hasOverduePayment && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                  Payment overdue
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{member.contact || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{member.checkInFormatted || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-primary">
                            {member.durationFormatted || 'N/A'}
                          </span>
                          {member.durationFormatted && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Active
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <Link
            href="/attendance"
            className="text-sm font-medium text-primary hover:underline"
            onClick={onClose}
          >
            View attendance history →
          </Link>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
