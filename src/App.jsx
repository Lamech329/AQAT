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
import { clearCriterionFiles, createAssessmentInstance, getCriterionFiles, getMissingChecklistRequirements } from './utils/assessmentCopies'
import { printChecklistSummary } from './utils/checklistPrint'
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
  const missingRequirements = useMemo(
    () => getMissingChecklistRequirements(checklist.items, checklist.header),
    [checklist.items, checklist.header],
  )
  const canSubmit = missingRequirements.length === 0 && checklist.status === 'draft'

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

  const handleStatusChange = async (itemId, status) => {
    const current = checklistRef.current
    const currentItem = current.items[itemId] ?? {}
    if (status === 'na') {
      const attachments = getCriterionFiles(currentItem)
      if (attachments.length) {
        const removeFiles = window.confirm(`Switching to N/A will remove ${attachments.length} uploaded file${attachments.length > 1 ? 's' : ''}. Continue?`)
        if (!removeFiles) {
          return
        }
        try {
          for (const attachment of attachments) {
            if (attachment.path) await removeAttachment(current.id, attachment.path)
          }
          updateItem(itemId, {
            status,
            ...clearCriterionFiles(currentItem),
          })
          return
        } catch (error) {
          alert(`Failed to remove attached files: ${error.message}`)
          return
        }
      }
    }
    updateItem(itemId, { status })
  }

  const handleAddAssessmentInstance = (itemId) => {
    const currentItem = checklistRef.current.items[itemId] ?? {}
    const instances = currentItem.assessmentInstances ?? []
    const nextNumber = instances.reduce((max, instance) => {
      const number = Number(instance.label.match(/(\d+)$/)?.[1] ?? 0)
      return Math.max(max, number)
    }, 0) + 1
    updateItem(itemId, { assessmentInstances: [...instances, createAssessmentInstance(itemId, nextNumber)] })
  }

  const handleRenameAssessmentInstance = (itemId, instanceId, label) => {
    const currentItem = checklistRef.current.items[itemId] ?? {}
    const assessmentInstances = (currentItem.assessmentInstances ?? []).map((instance) => (
      instance.id === instanceId ? { ...instance, label } : instance
    ))
    updateItem(itemId, { assessmentInstances })
  }

  const handleRemoveAssessmentInstance = async (itemId, instance) => {
    if (!window.confirm(`Remove "${instance.label}" and its attached files? This cannot be undone.`)) return
    try {
      for (const attachment of Object.values(instance.attachments ?? {})) {
        if (attachment?.path) await removeAttachment(checklistRef.current.id, attachment.path)
      }
      const current = checklistRef.current
      const currentItem = current.items[itemId] ?? {}
      updateItem(itemId, {
        assessmentInstances: (currentItem.assessmentInstances ?? []).filter((candidate) => candidate.id !== instance.id),
      })
    } catch (error) {
      alert(`Failed to remove assessment files: ${error.message}`)
    }
  }

  const handleFileChange = async (itemId, fileOrFiles, assessmentInstanceId = null, assessmentInstanceLabel = null, copySlot = null) => {
    const files = Array.isArray(fileOrFiles) ? fileOrFiles : fileOrFiles ? [fileOrFiles] : []
    if (!files.length) return
    try {
      const current = checklistRef.current
      const currentItem = current.items[itemId] ?? {}

      if (copySlot) {
        const currentInstance = currentItem.assessmentInstances?.find((instance) => instance.id === assessmentInstanceId)
        const previousAttachment = currentInstance?.attachments?.[copySlot]
        if (previousAttachment?.path) {
          await removeAttachment(current.id, previousAttachment.path)
          const latest = checklistRef.current
          const latestItem = latest.items[itemId] ?? {}
          const clearedItem = {
            ...latestItem,
            assessmentInstances: (latestItem.assessmentInstances ?? []).map((instance) => (
              instance.id === assessmentInstanceId
                ? { ...instance, attachments: { ...instance.attachments, [copySlot]: null } }
                : instance
            )),
          }
          const clearedChecklist = {
            ...latest,
            items: { ...latest.items, [itemId]: clearedItem },
          }
          setChecklistRecord(clearedChecklist)
          await saveItem(clearedChecklist.id, itemId, clearedItem)
        }
        const uploaded = await uploadFile(current.id, files[0], itemId, assessmentInstanceId, copySlot)
        const latestChecklist = checklistRef.current
        const latestItem = latestChecklist.items[itemId] ?? {}
        const latestInstance = latestItem.assessmentInstances?.find((instance) => instance.id === assessmentInstanceId)
        if (!latestInstance) {
          if (uploaded.path) await removeAttachment(latestChecklist.id, uploaded.path)
          throw new Error('The assessment instance was removed before its upload finished.')
        }
        const attachment = { ...uploaded, assessmentInstanceId, assessmentInstanceLabel: latestInstance.label, copySlot }
        const item = {
          ...latestItem,
          assessmentInstances: (latestItem.assessmentInstances ?? []).map((instance) => (
            instance.id === assessmentInstanceId
              ? { ...instance, attachments: { ...instance.attachments, [copySlot]: attachment } }
              : instance
          )),
        }
        const updatedChecklist = { ...latestChecklist, items: { ...latestChecklist.items, [itemId]: item } }
        setChecklistRecord(updatedChecklist)
        await saveItem(updatedChecklist.id, itemId, item)
        return
      }

      const existingAttachments = Array.isArray(currentItem.attachments) ? currentItem.attachments.filter(Boolean) : currentItem.attachment ? [currentItem.attachment] : []
      const uploadedFiles = []
      for (const file of files) {
        uploadedFiles.push(await uploadFile(current.id, file, itemId))
      }
      const item = {
        ...currentItem,
        attachments: [...existingAttachments, ...uploadedFiles],
        attachment: uploadedFiles[0] ?? null,
      }
      const updatedChecklist = { ...current, items: { ...current.items, [itemId]: item } }
      setChecklistRecord(updatedChecklist)
      await saveItem(updatedChecklist.id, itemId, item)
    } catch (error) {
      setSubmitError(error.message ?? 'Unable to save attachment.')
    }
  }

  const handleRemoveAttachment = async (itemId, attachment, assessmentInstanceId = null, copySlot = null) => {
    if (!attachment) return
    try {
      if (attachment.path) {
        await removeAttachment(checklist.id, attachment.path)
      }
      const current = checklistRef.current
      const currentItem = current.items[itemId] ?? {}

      if (copySlot) {
        const item = {
          ...currentItem,
          assessmentInstances: (currentItem.assessmentInstances ?? []).map((instance) => (
            instance.id === assessmentInstanceId
              ? { ...instance, attachments: { ...instance.attachments, [copySlot]: null } }
              : instance
          )),
        }
        const updatedChecklist = { ...current, items: { ...current.items, [itemId]: item } }
        setChecklistRecord(updatedChecklist)
        await saveItem(updatedChecklist.id, itemId, item)
        return
      }

      const attachments = Array.isArray(currentItem.attachments)
        ? currentItem.attachments.filter((file) => attachment.path ? file?.path !== attachment.path : file !== attachment)
        : []
      const item = { ...currentItem, attachments, attachment: attachments[0] ?? null }
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
          onPrint={() => printChecklistSummary(checklist)}
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
        onStatusChange={handleStatusChange}
        onFileChange={handleFileChange}
        onCommentChange={(itemId, comments) => updateItem(itemId, { comments })}
        onRemoveAttachment={handleRemoveAttachment}
        onAddAssessmentInstance={handleAddAssessmentInstance}
        onRenameAssessmentInstance={handleRenameAssessmentInstance}
        onRemoveAssessmentInstance={handleRemoveAssessmentInstance}
      />
      <FooterComments footer={checklist.footer} onChange={updateFooter} />
      <div className="submit-row">
        <div>
          <p>{canSubmit ? 'All requirements and marked-assessment copies are ready to submit.' : 'Resolve the following before submitting:'}</p>
          {missingRequirements.length > 0 && <ul className="missing-requirements-list">{missingRequirements.map((group) => (
            <li key={group.id}>
              <strong>{group.label}</strong>
              <ul>{group.missing.map((missing) => <li key={missing}>{missing}</li>)}</ul>
            </li>
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