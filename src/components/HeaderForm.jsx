import { useEffect } from 'react'
import { lecturerSubjects } from '../data/lecturerSubjects'
import { subjectSemesters } from '../data/subjectSemesters'

const fields = [
  { name: 'department', label: 'Department', type: 'text' },
  { name: 'staffName', label: 'Name of Staff', type: 'select' },
  { name: 'subjectName', label: 'Subject Name', type: 'text' },
  { name: 'subjectCode', label: 'Subject Code', type: 'text' },
  { name: 'semester', label: 'Semester', type: 'select' },
  { name: 'year', label: 'Year', type: 'number' },
]

export function HeaderForm({ header, onChange, readOnly = false }) {
  const sortedLecturers = [...lecturerSubjects].sort((a, b) => a.name.localeCompare(b.name))

  // Controlled selected staff value (exact string from header)
  const selectedStaff = header.staffName ?? ''
  const staffInList = selectedStaff && sortedLecturers.some((l) => l.name === selectedStaff)

  const handleStaffChange = (event) => {
    const value = event.target.value
    // update staffName exactly as selected
    onChange('staffName', value)
    // find subject for selected lecturer and update
    const found = lecturerSubjects.find((l) => l.name === value)
    onChange('subjectName', found ? found.subject : '')
  }

  // derive subject code entry and hint
  const selectedCode = header.subjectCode ?? ''
  const sortedSubjects = [...subjectSemesters].sort((a, b) => a.code.localeCompare(b.code))
  const codeEntry = subjectSemesters.find((s) => s.code === selectedCode)
  const singleSemester = Boolean(codeEntry && codeEntry.semesters.length === 1)

  const handleSubjectCodeChange = (event) => {
    const value = event.target.value
    onChange('subjectCode', value)

    const entry = subjectSemesters.find((s) => s.code === value)
    if (entry) {
      if (entry.semesters.length === 1) {
        const { year, semester } = entry.semesters[0]
        onChange('semester', String(semester))
        onChange('year', String(year))
      }
      // if multiple semesters, leave semester/year for user to select/confirm
    } else {
      // cleared selection
      onChange('semester', '')
      onChange('year', '')
    }
  }

  // Ensure Department is locked to 'Business'
  useEffect(() => {
    if (!header.department) onChange('department', 'Business')
  }, [header.department, onChange])

  return (
    <section className="card header-card" aria-labelledby="subject-details">
      <div className="section-heading">
        <div>
          <p className="eyebrow">PNG University of Technology</p>
          <h2 id="subject-details">Subject details</h2>
        </div>
        <span className="required-note">All fields are required</span>
      </div>
      <div className="header-grid">
        {fields.map((field) => (
          <label key={field.name}>
            <span>{field.label}</span>

            {field.name === 'department' ? (
              // Department locked to Business
              <input
                type="text"
                value={header.department ?? 'Business'}
                readOnly
                disabled
                required
              />
            ) : field.name === 'staffName' ? (
              // Lecturer select
              <select
                value={selectedStaff}
                onChange={handleStaffChange}
                disabled={readOnly}
                required
              >
                <option value="">Select</option>

                {/* If there is a selection that's not in the list, show it so it's visible */}
                {selectedStaff && !staffInList && (
                  <option value={selectedStaff}>{selectedStaff}</option>
                )}

                {sortedLecturers.map((l) => (
                  <option key={l.name} value={l.name}>{l.name}</option>
                ))}
              </select>
            ) : field.name === 'subjectName' ? (
              // Subject name is derived from lecturer selection — read-only
              <input
                type="text"
                value={header.subjectName ?? ''}
                readOnly
                disabled={readOnly}
                required
              />
            ) : field.name === 'subjectCode' ? (
              // Subject code dropdown
              <>
                <select
                  value={selectedCode}
                  onChange={handleSubjectCodeChange}
                  disabled={readOnly}
                  required
                >
                  <option value="">Select</option>
                  {sortedSubjects.map((s) => (
                    <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
                  ))}
                </select>
              </>
            ) : field.type === 'select' ? (
              field.name === 'semester' ? (
                <>
                  <select
                        value={header[field.name]}
                        onChange={(event) => onChange(field.name, event.target.value)}
                        disabled={readOnly || singleSemester}
                        required
                      >
                        <option value="1">1</option>
                        <option value="2">2</option>
                      </select>
                    </>
              ) : (
                <select
                  value={header[field.name]}
                  onChange={(event) => onChange(field.name, event.target.value)}
                  disabled={readOnly}
                  required
                >
                  <option value="">Select</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                </select>
              )
            ) : field.name === 'year' ? (
              // Year is auto-filled/locked when the subject code maps to exactly one semester
              <input
                type="number"
                min="2000"
                value={header.year ?? ''}
                onChange={(event) => { if (!(codeEntry && codeEntry.semesters.length === 1)) onChange('year', event.target.value) }}
                disabled={readOnly || Boolean(codeEntry && codeEntry.semesters.length === 1)}
                readOnly={readOnly || Boolean(codeEntry && codeEntry.semesters.length === 1)}
                required
              />
            ) : (
              <input
                type={field.type}
                min={field.name === 'year' ? '2000' : undefined}
                value={header[field.name]}
                onChange={(event) => onChange(field.name, event.target.value)}
                disabled={readOnly}
                required
              />
            )}
          </label>
        ))}
      </div>
    </section>
  )
}