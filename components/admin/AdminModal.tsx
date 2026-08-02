import type { ReactNode } from "react";

type AdminModalProps = {
  isOpen: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
};

const widthClasses = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export default function AdminModal({
  isOpen,
  title,
  description,
  onClose,
  children,
  maxWidth = "md",
}: AdminModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white p-6 shadow-2xl ${widthClasses[maxWidth]}`}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {title}
            </h2>

            {description && (
              <p className="mt-1 text-sm text-slate-600">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none text-slate-500 hover:text-slate-900"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}