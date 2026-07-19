export default function StudioLoading() {
  return (
    <main className="studio studio-loading" aria-label="Loading flower studio">
      <div className="studio-loading-card">
        <div className="studio-loading-mark">Loading Studio</div>
        <div className="studio-loading-track" aria-hidden="true">
          <span className="studio-loading-progress" />
        </div>
      </div>
    </main>
  );
}
