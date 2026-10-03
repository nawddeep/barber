import { Button } from "@/components/ui";

export function ComingSoon({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div>
      <h1 className="font-display text-5xl text-green">{title}</h1>
      <p className="mt-2 text-muted-strong">{blurb}</p>
      <div className="mt-8 rounded-card bg-white p-10 text-center">
        <p className="font-display text-3xl text-green">Coming soon</p>
        <p className="mx-auto mt-2 max-w-md text-muted-strong">This part of the owner panel is not built yet. The dashboard is live.</p>
        <Button href="/admin" className="mt-6">Back to dashboard</Button>
      </div>
    </div>
  );
}
