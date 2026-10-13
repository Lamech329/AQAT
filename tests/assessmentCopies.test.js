import test from 'node:test'
import assert from 'node:assert/strict'
import { dashboardPath, hasRoleAccess, normalizeRole, portalMismatchMessage } from '../src/auth/roles.js'
import { flatChecklistItems } from '../src/data/checklistItems.js'
import {
  COPY_SLOTS,
  MARKED_ASSESSMENTS,
  clearCriterionFiles,
  getCopyProgress,
  getCriterionFiles,
  getMissingChecklistRequirements,
  getMissingCopySlots,
  normalizeChecklistState,
  normalizeAssessmentItems,
  normalizeRegularItem,
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

test('every assessment instance requires a question paper and three marked copies', () => {
  assert.deepEqual(COPY_SLOTS.map(({ id }) => id), ['question_paper', 'lowest', 'median', 'highest'])
  assert.equal(flatChecklistItems.find(({ id }) => id === '4').label, 'Assignments, question paper & 3 marked copies')
  assert.equal(flatChecklistItems.find(({ id }) => id === '4').marker, 'copies')
  assert.deepEqual(MARKED_ASSESSMENTS.map(({ id }) => id), ['4', '5', '6', '7', '9'])

  const missing = getMissingCopySlots({})
  assert.equal(missing.length, MARKED_ASSESSMENTS.length * COPY_SLOTS.length)
  assert.deepEqual(missing.slice(0, 4).map(({ label }) => label), ['Question paper', 'Lowest mark', 'Median mark', 'Highest mark'])

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
  assert.deepEqual(getCopyProgress(state['4'].assessmentInstances[0]), { uploaded: 4, required: 4 })

  state['4'].assessmentInstances[0].attachments.question_paper = null
  assert.deepEqual(
    getMissingCopySlots(state).map(({ assessmentId, slotId }) => [assessmentId, slotId]),
    [['4', 'question_paper']],
  )
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
    [['Test 2', 'Question paper'], ['Test 2', 'Highest mark']],
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
  state['7'] = { status: 'na', assessmentInstances: [{ id: 'na-test', label: 'N/A Test', attachments: {} }] }
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
    label: '7. Tests, question paper & 3 marked copies',
    missing: ['Test 2: question paper missing', 'Test 2: median copy missing'],
  }])

  state['7'] = { status: '', assessmentInstances: [] }
  const noInstance = getMissingChecklistRequirements(state, header)
  assert(noInstance.find(({ id }) => id === '7').missing.includes('status not set'))
  assert(noInstance.find(({ id }) => id === '7').missing.includes('at least one assessment instance required'))
})

test('legacy single attachment values are normalized to attachment arrays', () => {
  const single = normalizeRegularItem({ status: 'yes', attachment: { name: 'legacy.pdf', path: '/legacy.pdf' } })
  assert.deepEqual(single.attachments.map((file) => file.name), ['legacy.pdf'])
  assert.equal(single.attachment.name, 'legacy.pdf')

  const state = normalizeChecklistState({
    '1': { status: 'yes', attachment: { name: 'first.pdf', path: '/first.pdf' } },
    '2': { status: 'no', attachments: [{ name: 'second.pdf', path: '/second.pdf' }, { name: 'third.pdf', path: '/third.pdf' }] },
  })

  assert.deepEqual(state['1'].attachments.map((file) => file.name), ['first.pdf'])
  assert.deepEqual(state['2'].attachments.map((file) => file.name), ['second.pdf', 'third.pdf'])
})

test('legacy marked-copy instances gain an empty question-paper slot and require it before submit', () => {
  const normalized = normalizeAssessmentItems({
    '7': {
      status: 'yes',
      assessmentInstances: [{
        id: 'legacy-test',
        label: 'Legacy Test',
        attachments: {
          lowest: { name: 'low.pdf' },
          median: { name: 'median.pdf' },
          highest: { name: 'high.pdf' },
        },
      }],
    },
  })

  assert.equal(normalized['7'].assessmentInstances[0].attachments.question_paper, null)
  assert.deepEqual(
    getMissingCopySlots(normalized)
      .filter(({ assessmentId }) => assessmentId === '7')
      .map(({ assessmentInstanceLabel, slotId }) => [assessmentInstanceLabel, slotId]),
    [['Legacy Test', 'question_paper']],
  )
})

test('multiple attachments can be appended and removed without replacing the list', () => {
  const item = {
    status: 'yes',
    attachments: [{ name: 'first.pdf', path: '/first.pdf' }],
  }
  const appended = {
    ...item,
    attachments: [...item.attachments, { name: 'second.pdf', path: '/second.pdf' }],
  }
  const remaining = appended.attachments.filter((attachment) => attachment.path !== '/first.pdf')

  assert.equal(appended.attachments.length, 2)
  assert.deepEqual(appended.attachments.map((attachment) => attachment.name), ['first.pdf', 'second.pdf'])
  assert.deepEqual(remaining.map((attachment) => attachment.name), ['second.pdf'])
})

test('N/A cleanup clears all regular and instance attachments', () => {
  const item = {
    status: 'yes',
    attachment: { name: 'regular.pdf', path: '/regular.pdf' },
    attachments: [{ name: 'regular.pdf', path: '/regular.pdf' }, { name: 'extra.pdf', path: '/extra.pdf' }],
    assessmentInstances: [{
      id: 'inst-1',
      label: 'Test 1',
      attachments: {
        question_paper: { name: 'question.pdf', path: '/question.pdf' },
        lowest: { name: 'low.pdf', path: '/low.pdf' },
        median: null,
        highest: { name: 'high.pdf', path: '/high.pdf' },
      },
    }],
  }

  assert.deepEqual(getCriterionFiles(item).map(({ path }) => path), ['/regular.pdf', '/extra.pdf', '/question.pdf', '/low.pdf', '/high.pdf'])
  const cleaned = clearCriterionFiles(item)
  assert.deepEqual(cleaned.attachments, [])
  assert.equal(cleaned.attachment, null)
  assert.deepEqual(cleaned.assessmentInstances[0].attachments, { question_paper: null, lowest: null, median: null, highest: null })
  assert.deepEqual(getCriterionFiles(cleaned), [])
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
          attachments: { question_paper: { name: 'question-paper.pdf' }, highest: { name: 'highest.pdf' } },
        }],
      },
    },
    footer: { reviewerComments: 'Footer reviewer note', additionalNotes: 'Footer additional note' },
    adminFeedback: 'Admin follow-up',
    adminComments: 'Admin-only comment',
  })

  assert.match(html, /Reviewed criterion comments/)
  assert.match(html, /Test 1<\/strong> — Highest mark: highest\.pdf/)
  assert.match(html, /Test 1<\/strong> — Question paper: question-paper\.pdf/)
  assert.match(html, /Footer reviewer note/)
  assert.match(html, /Footer additional note/)
  assert.doesNotMatch(html, /Admin feedback|Admin comments|Admin follow-up|Admin-only comment/)
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
  assert.equal(summary.requiredCopySlots, 4)
  assert.equal(summary.incompleteSubmissions.length, 1)
  assert(summary.incompleteSubmissions[0].missing.some((missing) => missing.includes('lowest copy missing')))
})
