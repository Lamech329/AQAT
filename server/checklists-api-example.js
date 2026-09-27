// server/checklists-api-example.js
// Example helper functions for server-side checklist operations using the supabaseClient.

const supabase = require('./supabaseClient');

// List checklists owned by userId
async function listChecklists(userId) {
  const { data, error } = await supabase
    .from('checklists')
    .select('*')
    .eq('owner', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// Create a checklist and optionally upload a file to storage and record metadata
// file: { buffer: <Buffer>, filename: 'name.ext', contentType: 'mime/type' }
async function createChecklist({ id, data, owner }, file) {
  let fileMeta = null;

  if (file) {
    const bucket = 'uploads'; // create this bucket in Supabase dashboard
    const key = `${id}/${file.filename}`;

    // upload (node Buffer supported)
    const { error: uploadErr } = await supabase.storage.from(bucket).upload(key, file.buffer, { contentType: file.contentType });
    if (uploadErr) throw uploadErr;

    const publicUrl = supabase.storage.from(bucket).getPublicUrl(key).data?.publicUrl || null;

    const { data: fm, error: fmErr } = await supabase
      .from('files')
      .insert([{ checklist_id: id, path: key, name: file.filename, content_type: file.contentType, size: file.buffer.length, uploaded_by: owner }])
      .select()
      .single();
    if (fmErr) throw fmErr;
    fileMeta = { ...fm, public_url: publicUrl };
  }

  const { data: ch, error } = await supabase
    .from('checklists')
    .insert([{ id, data, owner }])
    .select()
    .single();
  if (error) throw error;

  return { checklist: ch, file: fileMeta };
}

module.exports = { listChecklists, createChecklist };
