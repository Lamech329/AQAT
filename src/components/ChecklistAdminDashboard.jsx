import { useEffect, useMemo, useState } from 'react'
import JSZip from 'jszip'
import { deleteChecklist, getApiConfig, getChecklist, listChecklists } from '../api/checklistApi'
import { flatChecklistItems } from '../data/checklistItems'
import { supabase } from '../utils/supabase/client'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'
import { DashboardTabs } from './DashboardTabs'

const PAGE_SIZE = 10
const DEFAULT_STALE_DAYS = 7

const statusLabel = (status) => status === 'reopened' ? 'Reopened' : status === 'submitted' ? 'Submitted' : 'Draft'
const dateTime = (value) => value ? new Date(value).toLocaleString() : '—'
const csvValue = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`
const FILES_BUCKET = 'aqat-attachments'

function isStale(record, staleDays) {
  if (!record.updatedAt) return false
  return Date.now() - new Date(record.updatedAt).getTime() > staleDays * 86400000
}

function recordFiles(record) {
  return Object.entries(record.items ?? {}).flatMap(([itemId, item]) => item.attachment ? [{
    ...item.attachment,
    itemId,
    itemLabel: flatChecklistItems.find((checklistItem) => checklistItem.id === itemId)?.label ?? itemId,
  }] : [])
}

export function ChecklistAdminDashboard({ superAdmin = false }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [department, setDepartment] = useState('')
  const [lecturer, setLecturer] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ key: 'updatedAt', direction: 'desc' })
  const [page, setPage] = useState(1)
  const [staleDays, setStaleDays] = useState(DEFAULT_STALE_DAYS)
  const [theme, setTheme] = useState(() => localStorage.getItem('aqat-theme') || 'light')
  const [selected, setSelected] = useState(null)
  const [files, setFiles] = useState([])
  const [filesLoading, setFilesLoading] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('aqat-theme', theme)
  }, [theme])

  useEffect(() => {
    let active = true
    getFullRecords()
      .then((fullRecords) => { if (active) setRecords(fullRecords) })
      .catch((loadError) => { if (active) setError(loadError.message ?? 'Unable to load checklists.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const departments = useMemo(() => [...new Set(records.map((record) => record.header?.department).filter(Boolean))].sort(), [records])
  const lecturers = useMemo(() => [...new Set(records.map((record) => record.header?.staffName).filter(Boolean))].sort(), [records])
  const submittedCount = records.filter((record) => record.status === 'submitted').length
  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase()
    return records
      .filter((record) => !department || record.header?.department === department)
      .filter((record) => !lecturer || record.header?.staffName === lecturer)
      .filter((record) => !status || record.status === status)
      .filter((record) => !query || `${record.header?.subjectCode} ${record.header?.staffName}`.toLowerCase().includes(query))
      .sort((first, second) => {
        const firstValue = sortValue(first, sort.key)
        const secondValue = sortValue(second, sort.key)
        return String(firstValue).localeCompare(String(secondValue), undefined, { numeric: true }) * (sort.direction === 'asc' ? 1 : -1)
      })
  }, [records, department, lecturer, status, search, sort])
  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE))
  const visibleRecords = filteredRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const progress = departments.map((name) => {
    const departmentRecords = records.filter((record) => record.header?.department === name)
    return { name, total: departmentRecords.length, submitted: departmentRecords.filter((record) => record.status === 'submitted').length }
  })

  const updateSort = (key) => setSort((current) => current.key === key
    ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
    : { key, direction: 'asc' })

  const exportCsv = () => {
    const headers = ['Subject Code', 'Subject Name', 'Department', 'Lecturer', 'Status', 'Submitted', 'Last updated']
    const rows = filteredRecords.map((record) => [
      record.header?.subjectCode, record.header?.subjectName, record.header?.department,
      record.header?.staffName, statusLabel(record.status), dateTime(record.submittedAt), dateTime(record.updatedAt),
    ])
    const blob = new Blob([[headers, ...rows].map((row) => row.map(csvValue).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'aqat-checklists.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const openFiles = async (record) => {
    setSelected(record)
    setFiles(recordFiles(record))
    setFilesLoading(true)
    try {
      if (getApiConfig().mode === 'supabase') {
        const { data, error: fileError } = await supabase.from('files').select('*').eq('checklist_id', record.id)
        if (fileError) throw fileError
        setFiles(data.map((file) => ({ ...file, itemLabel: file.name })))
        const { data: activity, error: activityError } = await supabase
          .from('activity_logs')
          .select('action, actor_email, created_at')
          .eq('checklist_id', record.id)
          .order('created_at', { ascending: false })
        if (activityError) throw activityError
        setSelected({ ...record, activityLog: activity.map((entry) => ({ action: entry.action, user: entry.actor_email || 'User', at: entry.created_at })) })
      }
    } catch (fileError) {
      setError(fileError.message ?? 'Unable to load files.')
    } finally {
      setFilesLoading(false)
    }
  }

  const handleDelete = async (record) => {
    const message = `This will permanently delete this checklist and any attached files for ${record.header?.subjectCode || 'this checklist'}. This cannot be undone.`
    const shouldDelete = window.confirm(message)
    if (!shouldDelete) return

    try {
      await deleteChecklist(record.id)
      const updatedRecords = await getFullRecords()
      setRecords(updatedRecords)
      if (selected?.id === record.id) {
        setSelected(null)
      }
    } catch (deleteError) {
      setError(deleteError.message ?? 'Unable to delete checklist.')
    }
  }

  const downloadFile = async (file) => {
    let blob
    if (file.dataUrl) {
      const response = await fetch(file.dataUrl)
      blob = await response.blob()
    } else if (file.path && getApiConfig().mode === 'supabase') {
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(FILES_BUCKET)
        .createSignedUrl(file.path, 60)
      if (signedUrlError) throw signedUrlError
      const response = await fetch(signedUrlData.signedUrl)
      if (!response.ok) throw new Error(`Unable to download ${file.name}.`)
      blob = await response.blob()
    } else if (file.url || file.downloadUrl) {
      blob = await (await fetch(file.url || file.downloadUrl)).blob()
    } else {
      throw new Error('This attachment has no downloadable content.')
    }
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = file.name
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const downloadAll = async () => {
    const zip = new JSZip()
    for (const file of files) {
      let blob
      if (file.dataUrl) blob = await (await fetch(file.dataUrl)).blob()
      else if (file.path) {
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from(FILES_BUCKET)
          .createSignedUrl(file.path, 60)
        if (signedUrlError) throw signedUrlError
        const response = await fetch(signedUrlData.signedUrl)
        if (!response.ok) throw new Error(`Unable to download ${file.name}.`)
        blob = await response.blob()
      } else if (file.url || file.downloadUrl) blob = await (await fetch(file.url || file.downloadUrl)).blob()
      if (blob) zip.file(file.name, blob)
    }

    const printSummary = (record) => {
      const printWindow = window.open('', '_blank', 'width=900,height=700')
      if (!printWindow) return
      const rows = flatChecklistItems.map((item) => {
        const state = record.items?.[item.id] ?? {}
        return `<tr><td>${item.order}</td><td>${item.label}</td><td>${state.status || '—'}</td><td>${state.attachment?.name || '—'}</td></tr>`
      }).join('')
      printWindow.document.write(`<html><head><title>AQAT Checklist ${record.header?.subjectCode || ''}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#172033}table{width:100%;border-collapse:collapse}th,td{padding:8px;border:1px solid #cbd5e1;text-align:left}h1{margin-bottom:4px}.meta{color:#475569;margin-bottom:24px}</style></head><body><h1>AQAT Subject File Checklist</h1><p class="meta">${record.header?.subjectCode || ''} — ${record.header?.subjectName || ''} — ${record.header?.department || ''} — ${record.header?.staffName || ''}</p><table><thead><tr><th>#</th><th>Required document</th><th>Status</th><th>Attachment</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>{window.print();window.close()}</script></body></html>`)
      printWindow.document.close()
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${selected.header?.subjectCode || selected.id}-attachments.zip`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <main className="app-shell loading">Loading checklist administration...</main>

  return (
    <main className="app-shell admin-dashboard">
      <header className="page-header">
        <div className="brand-mark">AQAT</div>
        <div><p className="eyebrow">{superAdmin ? 'System administration' : 'Administration'}</p><h1>{superAdmin ? 'Super Admin Dashboard' : 'Admin Dashboard'}</h1><p>Read-only checklist oversight</p></div>
        <div className="header-actions"><DashboardTabs /><UserMenu /><ThemeToggle theme={theme} onToggle={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} /></div>
      </header>
      {error && <p className="connection-feedback error">{error}</p>}
      <section className="admin-stats">
        <div className="card"><span>Submitted</span><strong>{submittedCount}/{records.length}</strong></div>
        <div className="card"><span>Pending</span><strong>{records.length - submittedCount}</strong></div>
        <div className="card"><span>Stale threshold</span><label><input type="number" min="1" value={staleDays} onChange={(event) => setStaleDays(Number(event.target.value) || DEFAULT_STALE_DAYS)} /> days</label></div>
      </section>
      <section className="card department-progress">
        <div className="section-heading"><div><p className="eyebrow">Coverage</p><h2>Department progress</h2></div></div>
        {progress.length === 0 ? <p className="required-note">No department data available.</p> : progress.map((item) => <div className="progress-row" key={item.name}><div><strong>{item.name}</strong><span>{item.submitted}/{item.total} submitted</span></div><progress max={item.total} value={item.submitted} /></div>)}
      </section>
      <section className="card">
        <div className="admin-toolbar">
          <input type="search" placeholder="Search subject code or lecturer" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} />
          <select value={department} onChange={(event) => { setDepartment(event.target.value); setPage(1) }}><option value="">All departments</option>{departments.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={lecturer} onChange={(event) => { setLecturer(event.target.value); setPage(1) }}><option value="">All lecturers</option>{lecturers.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}><option value="">All statuses</option><option value="submitted">Submitted</option><option value="reopened">Reopened</option><option value="draft">Draft</option></select>
          <button className="secondary-button" type="button" onClick={exportCsv}>Export CSV</button>
        </div>
        <div className="dashboard-table-wrap">
          <table className="dashboard-table admin-table">
            <thead>
              <tr>
                {[['subjectCode', 'Subject code'], ['subjectName', 'Subject name'], ['department', 'Department'], ['staffName', 'Lecturer'], ['status', 'Status'], ['submittedAt', 'Submitted'], ['updatedAt', 'Last updated']].map(([key, label]) => (
                  <th key={key}><button type="button" className="table-sort" onClick={() => updateSort(key)}>{label} {sort.key === key ? (sort.direction === 'asc' ? '↑' : '↓') : ''}</button></th>
                ))}
                {superAdmin && <th>Files</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((record) => (
                <tr key={record.id} className={isStale(record, staleDays) ? 'stale-row' : ''}>
                  <td>{record.header?.subjectCode || '—'}</td>
                  <td>{record.header?.subjectName || 'Untitled checklist'}</td>
                  <td>{record.header?.department || '—'}</td>
                  <td>{record.header?.staffName || '—'}</td>
                  <td><span className={`status-badge ${record.status}`}>{statusLabel(record.status)}</span>{isStale(record, staleDays) && <span className="stale-badge">Stale</span>}</td>
                  <td>{dateTime(record.submittedAt)}</td>
                  <td>{dateTime(record.updatedAt)}</td>
                  {superAdmin && <td><button className="secondary-button" type="button" onClick={() => openFiles(record)}>View files</button></td>}
                  <td><button className="delete-button" type="button" onClick={() => handleDelete(record)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination"><span>{filteredRecords.length} checklist(s)</span><div><button className="secondary-button" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {pageCount}</span><button className="secondary-button" disabled={page === pageCount} onClick={() => setPage((current) => current + 1)}>Next</button></div></div>
      </section>
      {superAdmin && selected && <FilePanel record={selected} files={files} loading={filesLoading} onClose={() => setSelected(null)} onDownload={downloadFile} onDownloadAll={downloadAll} onPrint={() => printSummary(selected)} />}
    </main>
  )
}

async function getFullRecords() {
  const summaries = await listChecklists()
  return Promise.all(summaries.map(async (summary) => {
    const record = await getChecklist(summary.id)
    return { ...summary, ...record, header: { ...record?.header, ...summaryToHeader(summary, record) }, status: summary.status === 'reopened' ? 'reopened' : record?.status ?? summary.status }
  }))
}

function summaryToHeader(summary, record) {
  return {
    subjectName: summary.subjectName ?? record?.header?.subjectName,
    subjectCode: summary.subjectCode ?? record?.header?.subjectCode,
    department: summary.department ?? record?.header?.department,
    staffName: summary.staffName ?? record?.header?.staffName,
  }
}

function sortValue(record, key) {
  if (key === 'subjectCode' || key === 'subjectName' || key === 'department' || key === 'staffName') return record.header?.[key] ?? ''
  return record[key] ?? ''
}

function FilePanel({ record, files, loading, onClose, onDownload, onDownloadAll, onPrint }) {
  const activity = record.activityLog ?? []
  return <div className="settings-overlay" role="presentation" onMouseDown={onClose}><aside className="settings-panel file-panel" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}><div className="settings-heading"><div><p className="eyebrow">Compliance files</p><h2>{record.header?.subjectCode || 'Checklist'} attachments</h2></div><button className="close-button" type="button" onClick={onClose}>×</button></div><div className="settings-actions"><button className="secondary-button" type="button" onClick={onPrint}>Print summary</button><button className="submit-button" type="button" disabled={!files.length} onClick={onDownloadAll}>Download all</button></div>{loading ? <p>Loading files...</p> : files.length === 0 ? <p className="required-note">No attachments found.</p> : <div className="file-list">{files.map((file) => <div className="file-row" key={`${file.path || file.name}-${file.itemId || ''}`}><div><strong>{file.name}</strong><small>{file.itemLabel}</small></div><button className="secondary-button" type="button" onClick={() => onDownload(file)}>Download</button></div>)}</div>}<div className="audit-panel"><p className="eyebrow">Activity</p><h3>Audit log</h3>{activity.length === 0 ? <p className="required-note">No local activity recorded.</p> : activity.slice().reverse().map((entry, index) => <p key={`${entry.at}-${index}`}><strong>{entry.action}</strong> by {entry.user} on {dateTime(entry.at)}</p>)}</div></aside></div>
}
