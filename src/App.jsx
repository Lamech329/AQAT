import { useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import {
  createChecklist,
  createChecklistId,
  emptyChecklist,
  getApiConfig,
  getChecklist,
  listChecklists,
  reopenChecklist,
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
import SuperAdminDashboard from './pages/SuperAdminDashboard'
import './style.css'

const THEME_STORAGE_KEY = 'aqat-theme'

const getInitialTheme = () => {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
  if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function ChecklistWorkspace() {
  const [checklist, setChecklist] = useState(emptyChecklist)
  const [checklists, setChecklists] = useState([])
  const [view, setView] = useState('dashboard')
  const [loaded, setLoaded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [theme, setTheme] = useState(getInitialTheme)
  const [apiConfig, setApiConfig] = useState(getApiConfig)
  const [settingsOpen, setSettingsOpen] = useState(false)

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
  const canSubmit = headerComplete && allResolved && checklist.status === 'draft'

  const openRecord = async (id, nextView) => {
    const record = await getChecklist(id)
    if (!record) return
    setChecklist(record)
    setView(nextView)

    if (nextView === 'editor') {
      const firstUnresolved = flatChecklistItems.find((item) => !record.items[item.id]?.status)
      if (firstUnresolved) {
        requestAnimationFrame(() => document.getElementById(`checklist-item-${firstUnresolved.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
      }
    }
  }

  const startNewChecklist = () => {
    setChecklist(emptyChecklist())
    setView('editor')
  }

  const updateHeader = (name, value) => {
    setChecklist((current) => {
      const header = { ...current.header, [name]: value }
      if (!current.id) {
        const newRecord = { ...current, id: createChecklistId(), header }
        createChecklist(newRecord)
        return newRecord
      }
      saveHeader(current.id, header)
      return { ...current, header }
    })
  }

  const updateItem = (itemId, changes) => {
    const item = { ...(checklist.items[itemId] ?? {}), ...changes }
    setChecklist((current) => ({
      ...current,
      items: { ...current.items, [itemId]: item },
    }))
    saveItem(checklist.id, itemId, item)
  }

  const handleFileChange = async (itemId, file) => {
    if (!file) return
    const attachment = await uploadFile(checklist.id, file)
    updateItem(itemId, { attachment })
  }

  const updateFooter = (name, value) => {
    const footer = { ...checklist.footer, [name]: value }
    setChecklist((current) => ({ ...current, footer }))
    if (checklist.id) saveFooter(checklist.id, footer)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    const submitted = await submitChecklist(checklist.id)
    setChecklist(submitted)
    setSubmitting(false)
    setView('summary')
  }

  const handleEdit = async () => {
    const reopened = await reopenChecklist(checklist.id)
    setChecklist(reopened)
    setView('editor')
  }

  const editRecord = async (id) => {
    const record = await getChecklist(id)
    if (!record) return
    const reopened = await reopenChecklist(id)
    setChecklist(reopened)
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
      />
      <FooterComments footer={checklist.footer} onChange={updateFooter} />
      <div className="submit-row">
        <p>{canSubmit ? 'All requirements are resolved. Your checklist is ready to submit.' : 'Resolve every checklist requirement before submitting.'}</p>
        <button className="submit-button" disabled={!canSubmit || submitting} onClick={handleSubmit}>
          {submitting ? 'Submitting...' : 'Submit Checklist'}
        </button>
      </div>
      {settingsOpen && <SettingsPanel config={apiConfig} onSave={setApiConfig} onClose={() => setSettingsOpen(false)} />}
    </main>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin', 'super_admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/super-admin" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminDashboard /></ProtectedRoute>} />
      <Route path="/" element={<ChecklistWorkspace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}