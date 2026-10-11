import test from 'node:test'
import assert from 'node:assert/strict'
import { dashboardPath, hasRoleAccess, normalizeRole, portalMismatchMessage } from '../src/auth/roles.js'
import { flatChecklistItems } from '../src/data/checklistItems.js'
import {
  COPY_SLOTS,
  MARKED_ASSESSMENTS,
  getCopyProgress,
  getMissingChecklistRequirements,
  getMissingCopySlots,
} from '../src/utils/assessmentCopies.js'
import { summarizeAdminRecords } from '../src/utils/adminSummary.js'
import { buildChecklistPrintHtml } from '../src/utils/checklistPrint.js'

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

test('every assessment instance requires its own three labelled copies', () => {
  assert.deepEqual(COPY_SLOTS.map(({ id }) => id), ['lowest', 'median', 'highest'])
  assert.deepEqual(MARKED_ASSESSMENTS.map(({ id }) => id), ['4', '5', '6', '7', '9'])

  const missing = getMissingCopySlots({})
  assert.equal(missing.length, MARKED_ASSESSMENTS.length * COPY_SLOTS.length)
  assert.deepEqual(missing.slice(0, 3).map(({ label }) => label), ['Lowest mark', 'Median mark', 'Highest mark'])

  const state = Object.fromEntries(MARKED_ASSESSMENTS.map(({ id }) => [
    id,
    {
      assessmentInstances: [{
        id: 'instance-1',
        label: `Assessment ${id} 1`,
        attachments: Object.fromEntries(COPY_SLOTS.map(({ id: slot }) => [slot, { name: `${id}-${slot}.pdf` }])),
      }],
    },
  ]))
  assert.deepEqual(getMissingCopySlots(state), [])
  assert.deepEqual(getCopyProgress(state['4'].assessmentInstances[0]), { uploaded: 3, required: 3 })
})

test('multiple instances are validated independently and an empty criterion requires one instance', () => {
  const state = Object.fromEntries(MARKED_ASSESSMENTS.map(({ id }) => [
    id,
    { status: 'na', assessmentInstances: [] },
  ]))
  state['7'] = {
    status: 'yes',
    assessmentInstances: [
      { id: 'test-1', label: 'Test 1', attachments: Object.fromEntries(COPY_SLOTS.map(({ id }) => [id, { name: `${id}-1.pdf` }])) },
      { id: 'test-2', label: 'Test 2', attachments: { lowest: { name: 'low.pdf' }, median: { name: 'median.pdf' }, highest: null } },
    ],
  }

  assert.deepEqual(
    getMissingCopySlots(state).map(({ assessmentInstanceLabel, label }) => [assessmentInstanceLabel, label]),
    [['Test 2', 'Highest mark']],
  )

  state['7'].assessmentInstances = []
  assert.deepEqual(
    getMissingCopySlots(state).map(({ assessmentId, label }) => [assessmentId, label]),
    [['7', 'at least one assessment instance required']],
  )
})

test('N/A criteria are exempt from copy requirements and missing requirements are grouped', () => {
  const state = Object.fromEntries(flatChecklistItems.map((item) => [item.id, { status: 'yes' }]))
  MARKED_ASSESSMENTS.forEach(({ id }) => {
    state[id] = { status: 'na', assessmentInstances: [] }
  })
  const header = {
    department: 'Science',
    staffName: 'Lecturer',
    subjectName: 'Physics',
    subjectCode: 'PHY-101',
    semester: '1',
    year: '2026',
  }
  assert.deepEqual(getMissingCopySlots(state), [])

  state['7'] = {
    status: 'yes',
    assessmentInstances: [
      { id: 'test-1', label: 'Test 1', attachments: Object.fromEntries(COPY_SLOTS.map(({ id }) => [id, { name: `${id}.pdf` }])) },
      { id: 'test-2', label: 'Test 2', attachments: { lowest: { name: 'low.pdf' }, median: null, highest: { name: 'high.pdf' } } },
    ],
  }
  const missing = getMissingChecklistRequirements(state, header)
  assert.deepEqual(missing, [{
    id: '7',
    label: '7. Tests with solutions & 3 marked copies',
    missing: ['Test 2: median copy missing'],
  }])

  state['7'] = { status: '', assessmentInstances: [] }
  const noInstance = getMissingChecklistRequirements(state, header)
  assert(noInstance.find(({ id }) => id === '7').missing.includes('status not set'))
  assert(noInstance.find(({ id }) => id === '7').missing.includes('at least one assessment instance required'))
})

test('print summary includes criterion comments, instance slots, and footer feedback', () => {
  const html = buildChecklistPrintHtml({
    header: { subjectCode: 'SCI-101', staffName: 'Lecturer', department: 'Science' },
    submittedAt: '2026-10-09T00:00:00.000Z',
    items: {
      '7': {
        status: 'yes',
        comments: 'Reviewed criterion comments',
        assessmentInstances: [{
          id: 'test-1',
          label: 'Test 1',
          attachments: { highest: { name: 'highest.pdf' } },
        }],
      },
    },
    footer: { reviewerComments: 'Footer reviewer note', additionalNotes: 'Footer additional note' },
    adminFeedback: 'Admin follow-up',
  })

  assert.match(html, /Reviewed criterion comments/)
  assert.match(html, /Test 1<\/strong> — Highest mark: highest\.pdf/)
  assert.match(html, /Footer reviewer note/)
  assert.match(html, /Footer additional note/)
  assert.match(html, /Admin follow-up/)
  assert.match(html, /Subject code:/)
  assert.match(html, /Lecturer:/)
  assert.match(html, /Department:/)
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
  assert(summary.incompleteSubmissions[0].missing.some((missing) => missing.includes('lowest copy missing')))
})
