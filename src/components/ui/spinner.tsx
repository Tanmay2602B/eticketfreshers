export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="relative">
        <div className="w-10 h-10 rounded-full border-3 border-slate-200" />
        <div className="absolute inset-0 w-10 h-10 rounded-full border-3 border-transparent border-t-primary-600 animate-spin" />
      </div>
    </div>
  );
}

export function PageSpinner() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-4">
        <Spinner />
        <p className="text-sm text-slate-500 animate-pulse">Loading...</p>
      </div>
    </div>
  );
}
