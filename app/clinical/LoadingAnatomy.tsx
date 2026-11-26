export default function LoadingAnatomy({
  stage,
  progress,
  onCancel,
}: {
  stage: string;
  progress?: number;
  onCancel: () => void;
}) {
  return (
    <div className="viewer-message anatomy-loading" role="status" aria-live="polite">
      <h3>{stage}</h3>
      <p>Explanations remain readable while anatomy loads.</p>
      {progress !== undefined && (
        <>
          <progress max="100" value={progress} aria-label="Anatomy download progress" />
          <span>{Math.round(progress)}%</span>
        </>
      )}
      <button onClick={onCancel}>Continue without 3D</button>
    </div>
  );
}
