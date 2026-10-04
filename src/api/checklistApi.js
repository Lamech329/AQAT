const RECORDS_KEY = 'aqat-subject-file-checklists'
const LEGACY_STORAGE_KEY = 'aqat-subject-file-checklist'
const API_CONFIG_KEY = 'apiConfig'
const defaultApiBaseUrl = import.meta.env.VITE_DEFAULT_API_BASE_URL ?? ''
import { flatChecklistItems } from '../data/checklistItems'
// Adjust this path if your Supabase client scaffolding landed somewhere else.
import { supabase } from '../utils/supabase/client'

const FILES_BUCKET = 'aqat-attachments'
const TEMPORARILY_DISABLED_MODES = new Set(['rest', 'database'])

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
  if (!saved) return defaultApiConfig

  const config = { ...defaultApiConfig, ...JSON.parse(saved) }
  if (TEMPORARILY_DISABLED_MODES.has(config.mode)) {
    return { ...config, mode: defaultApiConfig.mode }
  }
  return config
}

export const saveApiConfig = (config) => {
  const savedConfig = {
    ...defaultApiConfig,
    ...config,
    mode: TEMPORARILY_DISABLED_MODES.has(config.mode) ? defaultApiConfig.mode : config.mode,
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

const getCurrentUser = async () => {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('Sign in to save checklist data.')
  return data.user
}

const recordSupabaseActivity = async (checklistId, action) => {
  const user = await getCurrentUser()
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
    const user = await getCurrentUser()
    const { error } = await supabase.from('checklists').insert({
      id: record.id,
      data: { header: record.header, items: record.items, footer: record.footer },
      status: 'draft',
      owner: user.id,
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

    const user = await getCurrentUser()
    const { data, error } = await supabase
      .from('files')
      .insert({
        checklist_id: id,
        path,
        name: file.name,
        content_type: file.type,
        size: file.size,
        uploaded_by: user.id,
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

export const deleteChecklist = async (id) => {
  const config = getApiConfig()

  if (isSupabaseMode(config)) {
    const row = await fetchChecklistRow(id)
    const user = await getCurrentUser()
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profileError) throw profileError

    const isAdmin = profile.role === 'admin' || profile.role === 'super_admin'
    if (!isAdmin && (row.owner !== user.id || row.status !== 'draft')) {
      throw new Error('Only admins or the owner of a draft checklist can delete it.')
    }

    const { data: fileRows, error: filesError } = await supabase
      .from('files')
      .select('path')
      .eq('checklist_id', id)
    if (filesError) throw filesError

    const paths = new Set(fileRows.map((file) => file.path))
    Object.values(row.data?.items ?? {}).forEach((item) => {
      if (item?.attachment?.path) paths.add(item.attachment.path)
    })

    if (paths.size) {
      const { error: storageError } = await supabase.storage.from(FILES_BUCKET).remove([...paths])
      if (storageError) throw storageError
    }

    const { data: deletedRows, error } = await supabase
      .from('checklists')
      .delete()
      .eq('id', id)
      .select('id')
    if (error) throw error
    if (!deletedRows.length) {
      throw new Error('Checklist could not be deleted. It may have changed or you may not have permission.')
    }
    return
  }

  if (!isLocalMode(config)) return remoteRequest(config, `checklists/${encodeURIComponent(id)}`, { method: 'DELETE' })

  const records = readRecords()
  delete records[id]
  writeRecords(records)
}

export const removeAttachment = async (id, filePath) => {
  const config = getApiConfig()

  if (isSupabaseMode(config)) {
    if (!filePath) throw new Error('The attachment path is missing.')

    const { error: storageError } = await supabase.storage.from(FILES_BUCKET).remove([filePath])
    if (storageError) throw storageError

    const { data: deletedFiles, error: dbError } = await supabase
      .from('files')
      .delete()
      .eq('checklist_id', id)
      .eq('path', filePath)
      .select('path')
    if (dbError) throw dbError
    if (!deletedFiles.length) throw new Error('Attachment could not be removed. It may not belong to a draft checklist.')
    return
  }

  if (!isLocalMode(config)) return remoteRequest(config, `checklists/${encodeURIComponent(id)}/files/${encodeURIComponent(filePath)}`, { method: 'DELETE' })
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