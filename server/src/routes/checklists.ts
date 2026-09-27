import { Router } from 'express'
import { supabase } from '../lib/supabase'
import multer from 'multer'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

const table = 'checklists'

type ChecklistSummary = {
  id: string
  data: { header?: Record<string, string> } | null
  status: string | null
  submitted_at: string | null
}

router.get('/', async (_req, res) => {
  try {
    const { data, error } = await supabase.from(table).select('id, data, status, submitted_at')
    if (error) return res.status(500).json({ error: error.message })

    const list = ((data ?? []) as ChecklistSummary[]).map((row) => ({
      id: row.id,
      subjectName: row.data?.header?.subjectName ?? '',
      subjectCode: row.data?.header?.subjectCode ?? '',
      semester: row.data?.header?.semester ?? '',
      year: row.data?.header?.year ?? '',
      status: row.status ?? 'draft',
      submittedAt: row.submitted_at ?? null,
    }))

    list.sort((a, b) => ((b.submittedAt ?? '') as string).localeCompare((a.submittedAt ?? '') as string))
    res.json(list)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id', async (req, res) => {
  const { id } = req.params
  try {
    const { data, error } = await supabase.from(table).select('data, status, submitted_at').eq('id', id).single()
    if (error) return res.status(404).json({ error: error.message })
    res.json({ id, ...data })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  const checklist = req.body
  if (!checklist?.id) return res.status(400).json({ error: 'Checklist id is required' })
  try {
    const payload = { id: checklist.id, data: checklist, status: 'draft', submitted_at: null }
    const { error } = await supabase.from(table).insert(payload)
    if (error) return res.status(500).json({ error: error.message })
    res.status(201).json(checklist)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id/header', async (req, res) => {
  const { id } = req.params
  const header = req.body
  try {
    const { data, error } = await supabase.from(table).select('data').eq('id', id).single()
    if (error) return res.status(404).json({ error: error.message })
    const updated = { ...data.data, header: { ...data.data.header, ...header } }
    const { error: upErr } = await supabase.from(table).update({ data: updated }).eq('id', id)
    if (upErr) return res.status(500).json({ error: upErr.message })
    res.json(updated)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id/items/:itemId', async (req, res) => {
  const { id, itemId } = req.params
  const item = req.body
  try {
    const { data, error } = await supabase.from(table).select('data').eq('id', id).single()
    if (error) return res.status(404).json({ error: error.message })
    const updatedItems = { ...data.data.items, [itemId]: item }
    const updated = { ...data.data, items: updatedItems }
    const { error: upErr } = await supabase.from(table).update({ data: updated }).eq('id', id)
    if (upErr) return res.status(500).json({ error: upErr.message })
    res.json(updated)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/:id/files', upload.single('file'), async (req, res) => {
  const { id } = req.params
  const file = req.file as Express.Multer.File | undefined
  if (!file) return res.status(400).json({ error: 'No file uploaded' })

  try {
    const bucket = 'checklist-files'
    const filename = `${id}/${Date.now()}_${file.originalname}`
    const { data, error } = await supabase.storage.from(bucket).upload(filename, file.buffer, { contentType: file.mimetype, upsert: true })
    if (error) return res.status(500).json({ error: error.message })

    // return a minimal file descriptor
    res.json({ name: file.originalname, path: data.path, uploadedAt: new Date().toISOString() })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id/footer', async (req, res) => {
  const { id } = req.params
  const footer = req.body
  try {
    const { data, error } = await supabase.from(table).select('data').eq('id', id).single()
    if (error) return res.status(404).json({ error: error.message })
    const updated = { ...data.data, footer: { ...data.data.footer, ...footer } }
    const { error: upErr } = await supabase.from(table).update({ data: updated }).eq('id', id)
    if (upErr) return res.status(500).json({ error: upErr.message })
    res.json(updated)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/:id/submit', async (req, res) => {
  const { id } = req.params
  try {
    const { data, error } = await supabase.from(table).select('data').eq('id', id).single()
    if (error) return res.status(404).json({ error: error.message })
    const updated = { ...data.data, status: 'submitted' }
    const { error: upErr } = await supabase.from(table).update({ data: updated, status: 'submitted', submitted_at: new Date().toISOString() }).eq('id', id)
    if (upErr) return res.status(500).json({ error: upErr.message })
    res.json({ id, status: 'submitted' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id/status', async (req, res) => {
  const { id } = req.params
  const { status } = req.body
  try {
    const { error } = await supabase.from(table).update({ status }).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ id, status })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
