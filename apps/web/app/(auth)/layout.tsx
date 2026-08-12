export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <span className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-primary" />
          <span className="text-[15px] font-bold tracking-tight">OpenMontage</span>
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
            Studio
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
