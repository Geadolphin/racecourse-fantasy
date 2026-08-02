type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  buttonLabel?: string;
  onButtonClick?: () => void;
  buttonDisabled?: boolean;
};

export default function PageHeader({
  eyebrow,
  title,
  description,
  buttonLabel,
  onButtonClick,
  buttonDisabled = false,
}: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {eyebrow && (
          <p className="mb-1 text-sm font-semibold uppercase tracking-wider text-amber-600">
            {eyebrow}
          </p>
        )}

        <h1 className="text-3xl font-bold text-slate-900">
          {title}
        </h1>

        {description && (
          <p className="mt-2 text-slate-600">
            {description}
          </p>
        )}
      </div>

      {buttonLabel && onButtonClick && (
        <button
          type="button"
          onClick={onButtonClick}
          disabled={buttonDisabled}
          className="rounded-lg bg-green-800 px-5 py-3 font-semibold text-white transition hover:bg-green-900 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {buttonLabel}
        </button>
      )}
    </div>
  );
}