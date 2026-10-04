import test from 'node:test'
import assert from 'node:assert/strict'
import { dashboardPath, hasRoleAccess, normalizeRole, portalMismatchMessage } from '../src/auth/roles.js'
import { COPY_SLOTS, MARKED_ASSESSMENTS, getCopyProgress, getMissingCopySlots } from '../src/utils/assessmentCopies.js'
import { summarizeAdminRecords } from '../src/utils/adminSummary.js'

test('only staff and admin are recognized application roles', () => {
  assert.equal(normalizeRole('staff'), 'staff')
  assert.equal(normalizeRole('admin'), 'admin')
  assert.equal(normalizeRole('user'), null)
  assert.equal(normalizeRole('unknown'), null)
})

test('portal routing follows the account role, not a selected portal', () => {
  assert.equal(dashboardPath('staff'), '/staff')
  assert.equal(dashboardPath('admin'), '/admin')
  assert.equal(dashboardPath(null), '/login')
  assert.equal(hasRoleAccess('staff', ['staff']), true)
  assert.equal(hasRoleAccess('staff', ['admin']), false)
  assert.equal(hasRoleAccess('admin', ['staff']), false)
  assert.equal(hasRoleAccess('admin', ['admin']), true)
  assert.equal(portalMismatchMessage('admin', 'staff'), 'This account is not an admin account.')
  assert.equal(portalMismatchMessage('staff', 'staff'), '')
})

test('every marked assessment requires its own three labelled copies', () => {
  assert.deepEqual(COPY_SLOTS.map(({ id }) => id), ['lowest', 'median', 'highest'])
  assert.deepEqual(MARKED_ASSESSMENTS.map(({ id }) => id), ['4', '5', '6', '7', '9'])

  const missing = getMissingCopySlots({})
  assert.equal(missing.length, MARKED_ASSESSMENTS.length * COPY_SLOTS.length)
  assert.deepEqual(missing.slice(0, 3).map(({ label }) => label), ['Lowest mark', 'Median mark', 'Highest mark'])

  const state = Object.fromEntries(MARKED_ASSESSMENTS.map(({ id }) => [
    id,
    { attachments: Object.fromEntries(COPY_SLOTS.map(({ id: slot }) => [slot, { name: `${id}-${slot}.pdf` }])) },
  ]))
  assert.deepEqual(getMissingCopySlots(state), [])
  assert.deepEqual(getCopyProgress(state, '4'), { uploaded: 3, required: 3 })
})

test('Admin summary counts submitted records, departments, and missing copy slots', () => {
  const records = [
    {
      id: 'draft',
      status: 'draft',
      header: { department: 'Science' },
      items: {},
    },
    {
      id: 'submitted',
      status: 'submitted',
      submittedAt: '2026-10-01T00:00:00Z',
      header: { department: 'Science', staffName: 'Lecturer', subjectCode: 'SCI-101' },
      items: {},
    },
  ]
  const summary = summarizeAdminRecords(records)

  assert.equal(summary.total, 2)
  assert.equal(summary.drafts, 1)
  assert.equal(summary.submitted, 1)
  assert.equal(summary.coveragePercent, 50)
  assert.deepEqual(summary.departments, [{ name: 'Science', total: 2, submitted: 1 }])
  assert.equal(summary.latestSubmissions[0].header.staffName, 'Lecturer')
  assert.equal(summary.incompleteSubmissions.length, 1)
  assert(summary.incompleteSubmissions[0].missing.includes('Assignments with solutions & 3 marked copies: Lowest mark copy'))
})
