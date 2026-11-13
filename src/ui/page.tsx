import type { ReactNode } from "react";

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children && <p className="max-w-3xl text-sm text-muted-foreground">{children}</p>}
    </div>
  );
}

/** Tela que ainda vai ser construída: diz o que ela vai ter, para ninguém achar que é defeito. */
export function ComingSoon({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="surface p-6 text-sm text-muted-foreground">{children}</div>
    </>
  );
}
