import type { DashboardData } from '@/lib/types/dashboard'

const now = new Date()
const tenDaysFromNow = new Date(now)
tenDaysFromNow.setDate(now.getDate() + 10)

const twoHoursAgo = new Date(now)
twoHoursAgo.setHours(now.getHours() - 2)

const fiveHoursAgo = new Date(now)
fiveHoursAgo.setHours(now.getHours() - 5)

const oneDayAgo = new Date(now)
oneDayAgo.setDate(now.getDate() - 1)

export const MOCK_DASHBOARD_DATA: DashboardData = {
  rentStatus: {
    expenseId: 'mock-rent-1',
    description: 'Monthly Rent',
    totalAmount: 2400,
    dueDate: tenDaysFromNow.toISOString(),
    daysUntilDue: 10,
    members: [
      { memberId: 'mock-member-1', memberName: 'Ben', hasPaid: true },
      { memberId: 'mock-member-2', memberName: 'Sarah', hasPaid: true },
      { memberId: 'mock-member-3', memberName: 'Alex', hasPaid: false },
    ],
    paidCount: 2,
    totalCount: 3,
  },
  balances: [
    { memberId: 'mock-member-2', memberName: 'Sarah', netAmount: 22.0 },
    { memberId: 'mock-member-3', memberName: 'Alex', netAmount: -47.2 },
    { memberId: 'mock-member-4', memberName: 'Mike', netAmount: 15.0 },
  ],
  recentActivity: [
    {
      id: 'mock-activity-1',
      type: 'expense',
      actorName: 'Alex',
      description: 'added Groceries',
      amount: 34.5,
      createdAt: twoHoursAgo.toISOString(),
    },
    {
      id: 'mock-activity-2',
      type: 'shopping_item',
      actorName: 'Sarah',
      description: 'checked off 4 items on shopping list',
      createdAt: fiveHoursAgo.toISOString(),
    },
    {
      id: 'mock-activity-3',
      type: 'expense',
      actorName: 'You',
      description: 'settled up with Mike',
      amount: 15.0,
      createdAt: oneDayAgo.toISOString(),
    },
  ],
}
