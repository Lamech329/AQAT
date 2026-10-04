import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import {
  createChecklist,
  createChecklistId,
  deleteChecklist,
  emptyChecklist,
  getApiConfig,
  getChecklist,
  listChecklists,
  reopenChecklist,
  removeAttachment,
  saveFooter,
  saveHeader,
  saveItem,
  submitChecklist,
  uploadFile,
} from './api/checklistApi'
import { flatChecklistItems } from './data/checklistItems'
import { HeaderForm } from './components/HeaderForm'
import { Checklist } from './components/Checklist'
import { FooterComments } from './components/FooterComments'
import { Summary } from './components/Summary'
import { Dashboard } from './components/Dashboard'
import { SettingsButton, SettingsPanel } from './components/SettingsPanel'
import { ThemeToggle } from './components/ThemeToggle'
import { UserMenu } from './components/UserMenu'
import { ProtectedRoute } from './components/ProtectedRoute'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import { useAuth } from './context/AuthContext'
import { dashboardPath } from './auth/roles'
import { getMissingCopySlots } from './utils/assessmentCopies'
import './style.css'

const THEME_STORAGE_KEY = 'aqat-theme'

const getInitialTheme = () => {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
  if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function ChecklistWorkspace() {
  const [checklist, setChecklist] = useState(emptyChecklist)
  const checklistRef = useRef(checklist)
  checklistRef.current = checklist
  const [checklists, setChecklists] = useState([])
  const [view, setView] = useState('dashboard')
  const [loaded, setLoaded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [theme, setTheme] = useState(getInitialTheme)
  const [apiConfig, setApiConfig] = useState(getApiConfig)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const setChecklistRecord = (record) => {
    checklistRef.current = record
    setChecklist(record)
  }

  const toggleTheme = () => setTheme((current) => current === 'dark' ? 'light' : 'dark')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const refreshDashboard = async () => {
    const records = await listChecklists()
    setChecklists(records)
  }

  useEffect(() => {
    refreshDashboard().then(() => setLoaded(true))
  }, [])

  const headerComplete = useMemo(
    () => Object.values(checklist.header).every((value) => String(value).trim() !== ''),
    [checklist.header],
  )
  const allResolved = flatChecklistItems.every((item) => Boolean(checklist.items[item.id]?.status))
  const missingCopySlots = useMemo(() => getMissingCopySlots(checklist.items), [checklist.items])
  const canSubmit = headerComplete && allResolved && missingCopySlots.length === 0 && checklist.status === 'draft'

  const openRecord = async (id, nextView) => {
    const record = await getChecklist(id)
    if (!record) return
    setChecklistRecord(record)
    setView(nextView)

    if (nextView === 'editor') {
      const firstUnresolved = flatChecklistItems.find((item) => !record.items[item.id]?.status)
      if (firstUnresolved) {
        requestAnimationFrame(() => document.getElementById(`checklist-item-${firstUnresolved.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
      }
    }
  }

  const startNewChecklist = () => {
    setChecklistRecord(emptyChecklist())
    setView('editor')
  }

  const updateHeader = (name, value) => {
    const current = checklistRef.current
    const header = { ...current.header, [name]: value }
    if (!current.id) {
      const newRecord = { ...current, id: createChecklistId(), header }
      setChecklistRecord(newRecord)
      createChecklist(newRecord)
      return
    }
    setChecklistRecord({ ...current, header })
    saveHeader(current.id, header)
  }

  const updateItem = (itemId, changes) => {
    const current = checklistRef.current
    const item = { ...(current.items[itemId] ?? {}), ...changes }
    setChecklistRecord({ ...current, items: { ...current.items, [itemId]: item } })
    saveItem(current.id, itemId, item)
  }

  const handleFileChange = async (itemId, file, copySlot = null) => {
    if (!file) return
    try {
      const current = checklistRef.current
      const attachment = await uploadFile(current.id, file, itemId, copySlot)
      const currentItem = checklistRef.current.items[itemId] ?? {}
      const changes = copySlot
        ? { attachments: { ...(currentItem.attachments ?? {}), [copySlot]: attachment } }
        : { attachment }
      const item = { ...currentItem, ...changes }
      const updatedChecklist = { ...checklistRef.current, items: { ...checklistRef.current.items, [itemId]: item } }
      setChecklistRecord(updatedChecklist)
      await saveItem(updatedChecklist.id, itemId, item)
    } catch (error) {
      setSubmitError(error.message ?? 'Unable to save attachment.')
    }
  }

  const handleRemoveAttachment = async (itemId, attachment, copySlot = null) => {
    if (!attachment) return
    try {
      if (attachment.path) {
        await removeAttachment(checklist.id, attachment.path)
      }
      const current = checklistRef.current
      const currentItem = current.items[itemId] ?? {}
      const changes = copySlot
        ? { attachments: { ...(currentItem.attachments ?? {}), [copySlot]: null } }
        : { attachment: null }
      const item = { ...currentItem, ...changes }
      const updatedChecklist = { ...current, items: { ...current.items, [itemId]: item } }
      setChecklistRecord(updatedChecklist)
      await saveItem(updatedChecklist.id, itemId, item)
    } catch (err) {
      alert(`Failed to remove attachment: ${err.message}`)
    }
  }

  const updateFooter = (name, value) => {
    const current = checklistRef.current
    const footer = { ...current.footer, [name]: value }
    setChecklistRecord({ ...current, footer })
    if (current.id) saveFooter(current.id, footer)
  }

  const handleSubmit = async () => {
    setSubmitError('')
    setSubmitting(true)
    try {
      const submitted = await submitChecklist(checklist.id)
      setChecklistRecord(submitted)
      setView('summary')
    } catch (error) {
      setSubmitError(error.message ?? 'Unable to submit checklist.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = async () => {
    const reopened = await reopenChecklist(checklist.id)
    setChecklistRecord(reopened)
    setView('editor')
  }

  const handleDelete = async () => {
    const shouldDelete = window.confirm('This will permanently delete this draft checklist. This cannot be undone.')
    if (!shouldDelete) return

    try {
      await deleteChecklist(checklist.id)
      await refreshDashboard()
      returnToDashboard()
    } catch (err) {
      alert(`Failed to delete checklist: ${err.message}`)
    }
  }

  const editRecord = async (id) => {
    const record = await getChecklist(id)
    if (!record) return
    const reopened = await reopenChecklist(id)
    setChecklistRecord(reopened)
    setView('editor')
  }

  const returnToDashboard = async () => {
    await refreshDashboard()
    setView('dashboard')
  }

  if (!loaded) {
    return <main className="app-shell loading">Loading your saved checklists...</main>
  }

  if (view === 'dashboard') {
    return (
      <>
        <Dashboard
          checklists={checklists}
          onNew={startNewChecklist}
          onOpen={(id) => openRecord(id, 'editor')}
          onView={(id) => openRecord(id, 'summary')}
          onEdit={editRecord}
          theme={theme}
          onThemeToggle={toggleTheme}
          onSettingsOpen={() => setSettingsOpen(true)}
        />
        {settingsOpen && <SettingsPanel config={apiConfig} onSave={setApiConfig} onClose={() => setSettingsOpen(false)} />}
      </>
    )
  }

  if (view === 'summary') {
    return (
      <>
        <Summary
          header={checklist.header}
          items={flatChecklistItems}
          itemState={checklist.items}
          footer={checklist.footer}
          submittedAt={checklist.submittedAt}
          onPrint={() => window.print()}
          onEdit={handleEdit}
          onDashboard={returnToDashboard}
          theme={theme}
          onThemeToggle={toggleTheme}
          onSettingsOpen={() => setSettingsOpen(true)}
        />
        {settingsOpen && <SettingsPanel config={apiConfig} onSave={setApiConfig} onClose={() => setSettingsOpen(false)} />}
      </>
    )
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <div className="brand-mark">AQAT</div>
        <div>
          <p className="eyebrow">Academic Quality Assurance Team</p>
          <h1>Subject File Checklist</h1>
          <p>End-of-semester document compliance record</p>
        </div>
        <div className="header-actions">
          <button className="secondary-button dashboard-return" onClick={returnToDashboard}>All checklists</button>
          <UserMenu />
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <SettingsButton onClick={() => setSettingsOpen(true)} />
        </div>
      </header>
      <HeaderForm header={checklist.header} onChange={updateHeader} />
      <Checklist
        items={flatChecklistItems}
        itemState={checklist.items}
        headerComplete={headerComplete}
        onStatusChange={(itemId, status) => updateItem(itemId, { status })}
        onFileChange={handleFileChange}
        onCommentChange={(itemId, comments) => updateItem(itemId, { comments })}
        onRemoveAttachment={handleRemoveAttachment}
      />
      <FooterComments footer={checklist.footer} onChange={updateFooter} />
      <div className="submit-row">
        <div>
          <p>{canSubmit ? 'All requirements and marked-assessment copies are ready to submit.' : 'Resolve every checklist requirement and add all marked-assessment copies before submitting.'}</p>
          {missingCopySlots.length > 0 && <ul className="missing-copy-list">{missingCopySlots.map(({ assessmentId, assessmentLabel, label }) => (
            <li key={`${assessmentId}-${label}`}>{assessmentLabel}: {label} copy missing</li>
          ))}</ul>}
          {submitError && <p className="connection-feedback error">{submitError}</p>}
        </div>
        <div className="submit-row-actions">
          {checklist.status === 'draft' && (
            <button className="delete-button" onClick={handleDelete}>Delete Draft</button>
          )}
          <button className="submit-button" disabled={!canSubmit || submitting} onClick={handleSubmit}>
            {submitting ? 'Submitting...' : 'Submit Checklist'}
          </button>
        </div>
      </div>
      {settingsOpen && <SettingsPanel config={apiConfig} onSave={setApiConfig} onClose={() => setSettingsOpen(false)} />}
    </main>
  )
}

export default function App() {
  const { currentRole, isAuthenticated, loading } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/admin/*" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/staff/*" element={<ProtectedRoute allowedRoles={['staff']}><ChecklistWorkspace /></ProtectedRoute>} />
      <Route path="/" element={loading ? <main className="app-shell loading">Loading your account...</main> : <Navigate to={isAuthenticated ? dashboardPath(currentRole) : '/login'} replace />} />
      <Route path="*" element={loading ? <main className="app-shell loading">Loading your account...</main> : <Navigate to={isAuthenticated ? dashboardPath(currentRole) : '/login'} replace />} />
    </Routes>
  )
}