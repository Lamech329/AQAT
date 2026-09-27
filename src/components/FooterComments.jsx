export function FooterComments({ footer, onChange, readOnly = false }) {
  return (
    <section className="card footer-card" aria-labelledby="notes-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Open-ended feedback</p>
          <h2 id="notes-heading">Comments and notes</h2>
        </div>
      </div>
      <div className="footer-grid">
        <label>
          <span>Reviewer Comments</span>
          <textarea
            value={footer.reviewerComments}
            onChange={(event) => onChange('reviewerComments', event.target.value)}
            disabled={readOnly}
            rows="5"
          />
        </label>
        <label>
          <span>Additional Notes</span>
          <textarea
            value={footer.additionalNotes}
            onChange={(event) => onChange('additionalNotes', event.target.value)}
            disabled={readOnly}
            rows="5"
          />
        </label>
      </div>
    </section>
  )
}
