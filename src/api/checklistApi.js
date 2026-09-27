const RECORDS_KEY = 'aqat-subject-file-checklists'
const LEGACY_STORAGE_KEY = 'aqat-subject-file-checklist'
const API_CONFIG_KEY = 'apiConfig'
const defaultApiBaseUrl = import.meta.env.VITE_DEFAULT_API_BASE_URL ?? ''
import { flatChecklistItems } from '../data/checklistItems'
// Adjust this path if your Supabase client scaffolding landed somewhere else.
import { supabase } from '../utils/supabase/client'

const FILES_BUCKET = 'aqat-attachments'

export const defaultApiConfig = {
  mode: import.meta.env.VITE_SUPABASE_URL && (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY)
    ? 'supabase'
    : 'local', // 'local' | 'remote' | 'supabase'
  baseUrl: defaultApiBaseUrl,
  authType: 'none',
  credential: '',
}

export const emptyChecklist = () => ({
  id: null,
  header: {
    department: '',
    staffName: '',
    subjectName: '',
    subjectCode: '',
    semester: '',
    year: '',
  },
  items: Object.fromEntries(flatChecklistItems.map((item) => [
    item.id,
    { status: '', attachment: null, comments: '' },
  ])),
  footer: {
    reviewerComments: '',
    additionalNotes: '',
  },
  status: 'draft',
  submittedAt: null,
})

export const createChecklistId = () => (
  crypto.randomUUID?.() ?? `checklist-${Date.now()}-${Math.random().toString(36).slice(2)}`
)

export const getApiConfig = () => {
  const saved = localStorage.getItem(API_CONFIG_KEY)
  return saved ? { ...defaultApiConfig, ...JSON.parse(saved) } : defaultApiConfig
}

export const saveApiConfig = (config) => {
  const savedConfig = {
    ...defaultApiConfig,
    ...config,
    baseUrl: config.baseUrl.trim().replace(/\/+$/, ''),
    credential: config.credential.trim(),
  }
  localStorage.setItem(API_CONFIG_KEY, JSON.stringify(savedConfig))
  return savedConfig
}

const readRecords = () => {
  const savedRecords = localStorage.getItem(RECORDS_KEY)
  if (savedRecords) return JSON.parse(savedRecords)

  const legacyRecord = localStorage.getItem(LEGACY_STORAGE_KEY)
  if (!legacyRecord) return {}

  const legacyChecklist = JSON.parse(legacyRecord)
  const migratedRecord = {
    ...emptyChecklist(),
    ...legacyChecklist,
    header: { ...emptyChecklist().header, ...legacyChecklist.header },
    items: { ...emptyChecklist().items, ...legacyChecklist.items },
    footer: { ...emptyChecklist().footer, ...legacyChecklist.footer },
    id: createChecklistId(),
    status: legacyChecklist.submittedAt ? 'submitted' : 'draft',
  }
  const records = { [migratedRecord.id]: migratedRecord }
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records))
  localStorage.removeItem(LEGACY_STORAGE_KEY)
  return records
}

const writeRecords = (records) => {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records))
  return records
}

const localRecord = (id) => readRecords()[id] ?? null

const updateLocalRecord = (id, changes) => {
  const records = readRecords()
  const record = records[id]
  if (!record) throw new Error('Checklist record was not found.')

  const { _activityAction = 'edited', ...recordChanges } = changes
  const savedUser = JSON.parse(localStorage.getItem('aqat-auth-user') || 'null')
  const activity = {
    action: _activityAction,
    at: new Date().toISOString(),
    user: savedUser?.email ?? 'Local user',
  }
  const updatedRecord = {
    ...record,
    ...recordChanges,
    updatedAt: new Date().toISOString(),
    activityLog: [...(record.activityLog ?? []), activity],
  }
  writeRecords({ ...records, [id]: updatedRecord })
  return updatedRecord
}

const isLocalMode = (config) => config.mode === 'local'
const isSupabaseMode = (config) => config.mode === 'supabase'

const remoteRequest = async (config, endpoint, options = {}) => {
  if (!config.baseUrl) {
    throw new Error('A Base URL is required for a remote data source.')
  }

  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')

  if (config.authType === 'apiKey' && config.credential) {
    headers.set('X-API-Key', config.credential)
  }
  if (config.authType === 'bearer' && config.credential) {
    headers.set('Authorization', `Bearer ${config.credential}`)
  }

  const response = await fetch(`${config.baseUrl}/${endpoint}`, { ...options, headers })
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}.`)
  }

  const contentType = response.headers.get('content-type')
  return contentType?.includes('application/json') ? response.json() : null
}

const jsonRequest = (config, endpoint, method, body) => remoteRequest(config, endpoint, {
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

// ---------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------

const getCurrentUserId = async () => {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  return data.user?.id ?? null
}

const recordSupabaseActivity = async (checklistId, action) => {
  const { data, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const user = data.user
  if (!user) return
  const { error } = await supabase.from('activity_logs').insert({
    checklist_id: checklistId,
    action,
    actor_id: user.id,
    actor_email: user.email,
  })
  if (error) throw error
}

const fetchChecklistRow = async (id) => {
  const { data, error } = await supabase
    .from('checklists')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

const rowToChecklist = (row) => ({
  id: row.id,
  header: row.data?.header ?? emptyChecklist().header,
  items: row.data?.items ?? emptyChecklist().items,
  footer: row.data?.footer ?? emptyChecklist().footer,
  status: row.status === 'submitted' ? 'submitted' : row.data?.reopenedAt ? 'reopened' : row.status,
  submittedAt: row.submitted_at,
  updatedAt: row.updated_at,
  owner: row.owner,
  reopenedAt: row.data?.reopenedAt,
})

const patchChecklistData = async (id, dataPatch) => {
  const row = await fetchChecklistRow(id)
  const newData = { ...row.data, ...dataPatch }
  const { data, error } = await supabase
    .from('checklists')
    .update({ data: newData })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return rowToChecklist(data)
}

// ---------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------

export const listChecklists = async () => {
  const config = getApiConfig()

  if (isSupabaseMode(config)) {
    const { data, error } = await supabase
      .from('checklists')
      .select('id, data, status, submitted_at, updated_at, owner')
      .order('submitted_at', { ascending: false })
    if (error) throw error

    return data.map((row) => ({
      id: row.id,
      subjectName: row.data?.header?.subjectName,
      subjectCode: row.data?.header?.subjectCode,
      department: row.data?.header?.department,
      staffName: row.data?.header?.staffName,
      semester: row.data?.header?.semester,
      year: row.data?.header?.year,
      status: row.status === 'submitted' ? 'submitted' : row.data?.reopenedAt ? 'reopened' : row.status,
      submittedAt: row.submitted_at,
      updatedAt: row.updated_at,
      reopenedAt: row.data?.reopenedAt,
    }))
  }

  if (!isLocalMode(config)) return remoteRequest(config, 'checklists')

  return Object.values(readRecords())
    .map(({ id, header, status, submittedAt, updatedAt, reopenedAt }) => ({
      id,
      subjectName: header.subjectName,
      subjectCode: header.subjectCode,
      department: header.department,
      staffName: header.staffName,
      semester: header.semester,
      year: header.year,
      status,
      submittedAt,
      updatedAt: updatedAt ?? submittedAt,
      reopenedAt,
    }))
    .sort((first, second) => (second.submittedAt ?? '').localeCompare(first.submittedAt ?? ''))
}

export const getChecklist = async (id) => {
  const config = getApiConfig()

  if (isSupabaseMode(config)) {
    const row = await fetchChecklistRow(id)
    return rowToChecklist(row)
  }

  return isLocalMode(config)
    ? localRecord(id)
    : remoteRequest(config, `checklists/${encodeURIComponent(id)}`)
}

export const createChecklist = async (checklist) => {
  const config = getApiConfig()

  const record = {
    ...emptyChecklist(),
    ...checklist,
    header: { ...emptyChecklist().header, ...checklist.header },
    items: { ...emptyChecklist().items, ...checklist.items },
    footer: { ...emptyChecklist().footer, ...checklist.footer },
    status: 'draft',
    updatedAt: new Date().toISOString(),
  }

  if (isSupabaseMode(config)) {
    const ownerId = await getCurrentUserId()
    const { error } = await supabase.from('checklists').insert({
      id: record.id,
      data: { header: record.header, items: record.items, footer: record.footer },
      status: 'draft',
      owner: ownerId,
    })
    if (error) throw error
    return record
  }

  if (!isLocalMode(config)) return jsonRequest(config, 'checklists', 'POST', checklist)

  const records = readRecords()
  writeRecords({ ...records, [record.id]: record })
  return record
}

export const saveHeader = async (id, header) => {
  const config = getApiConfig()

  if (isSupabaseMode(config)) {
    const result = await patchChecklistData(id, { header })
    await recordSupabaseActivity(id, 'edited')
    return result
  }
  if (!isLocalMode(config)) return jsonRequest(config, `checklists/${encodeURIComponent(id)}/header`, 'PUT', header)
  return updateLocalRecord(id, { header })
}

export const saveItem = async (id, itemId, item) => {
  const config = getApiConfig()

  if (isSupabaseMode(config)) {
    const row = await fetchChecklistRow(id)
    const items = { ...row.data?.items, [itemId]: item }
    const result = await patchChecklistData(id, { items })
    await recordSupabaseActivity(id, 'edited')
    return result
  }

  if (!isLocalMode(config)) {
    return jsonRequest(config, `checklists/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}`, 'PUT', item)
  }

  const record = localRecord(id)
  return updateLocalRecord(id, {
    items: { ...record.items, [itemId]: item },
  })
}

export const uploadFile = async (id, file) => {
  const config = getApiConfig()

  if (isSupabaseMode(config)) {
    const path = `${id}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from(FILES_BUCKET).upload(path, file)
    if (uploadError) throw uploadError

    const ownerId = await getCurrentUserId()
    const { data, error } = await supabase
      .from('files')
      .insert({
        checklist_id: id,
        path,
        name: file.name,
        content_type: file.type,
        size: file.size,
        uploaded_by: ownerId,
      })
      .select()
      .single()
    if (error) throw error

    return {
      name: data.name,
      type: data.content_type,
      size: data.size,
      path: data.path,
      uploadedAt: data.uploaded_at,
    }
  }

  if (!isLocalMode(config)) {
    const formData = new FormData()
    formData.append('file', file)
    return remoteRequest(config, `checklists/${encodeURIComponent(id)}/files`, { method: 'POST', body: formData })
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read the selected file.'))
    reader.readAsDataURL(file)
  })

  return {
    name: file.name,
    type: file.type,
    size: file.size,
    lastModified: file.lastModified,
    uploadedAt: new Date().toISOString(),
    dataUrl,
  }
}

export const saveFooter = async (id, footer) => {
  const config = getApiConfig()

  if (isSupabaseMode(config)) {
    const result = await patchChecklistData(id, { footer })
    await recordSupabaseActivity(id, 'edited')
    return result
  }
  if (!isLocalMode(config)) return jsonRequest(config, `checklists/${encodeURIComponent(id)}/footer`, 'PUT', footer)
  return updateLocalRecord(id, { footer })
}

export const submitChecklist = async (id) => {
  const config = getApiConfig()

  if (isSupabaseMode(config)) {
    const submittedAt = new Date().toISOString()
    const { data, error } = await supabase
      .from('checklists')
      .update({ status: 'submitted', submitted_at: submittedAt })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    await recordSupabaseActivity(id, 'edited')
    return rowToChecklist(data)
  }

  if (!isLocalMode(config)) return remoteRequest(config, `checklists/${encodeURIComponent(id)}/submit`, { method: 'POST' })
  return updateLocalRecord(id, { status: 'submitted', submittedAt: new Date().toISOString() })
}

export const reopenChecklist = async (id) => {
  const config = getApiConfig()

  if (isSupabaseMode(config)) {
    const row = await fetchChecklistRow(id)
    const reopenedAt = new Date().toISOString()
    const { data, error } = await supabase
      .from('checklists')
      .update({ status: 'draft', data: { ...row.data, reopenedAt } })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    await recordSupabaseActivity(id, 'reopened')
    return rowToChecklist(data)
  }

  if (!isLocalMode(config)) return jsonRequest(config, `checklists/${encodeURIComponent(id)}/status`, 'PUT', { status: 'reopened' })
  return updateLocalRecord(id, { status: 'reopened', reopenedAt: new Date().toISOString(), _activityAction: 'reopened' })
}

export const pingApi = async () => {
  const config = getApiConfig()

  if (isSupabaseMode(config)) {
    const { error } = await supabase.from('checklists').select('id').limit(1)
    if (error) return { ok: false, message: error.message }
    return { ok: true, message: 'Connected to Supabase.' }
  }

  if (isLocalMode(config)) {
    return { ok: true, message: 'Local storage is active on this browser.' }
  }

  return remoteRequest(config, 'ping')
}