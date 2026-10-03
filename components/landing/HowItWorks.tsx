import { Flower } from "@/components/ui";

const STEPS = [
  { n: 1, tint: "bg-yellow", ink: "text-ink", title: "Choose branch & service", body: "Select the branch nearest you from the dropdown, then pick what you need done." },
  { n: 2, tint: "bg-orange", ink: "text-ink", title: "Pick barber & time", body: "See live availability for each barber and grab the slot that fits your day." },
  { n: 3, tint: "bg-blue", ink: "text-white", title: "Hold your slot", body: "Pay a small booking fee or verify your phone number. You get a confirmation by SMS." },
];

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-8 bg-cream-2 py-20 lg:py-24">
      <div className="mx-auto max-w-[1100px] px-6">
        <p className="text-center text-xs font-bold uppercase tracking-widest text-orange-ink-strong">How it works</p>
        <h2 id="how-title" className="mt-2 text-center font-display text-4xl text-green lg:text-5xl">Three taps to your chair</h2>
        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-card bg-white p-7">
              <Flower size={56} tint={s.tint}>
                <span className={`font-display text-xl ${s.ink}`}>{s.n}</span>
              </Flower>
              <h3 className="mt-6 font-display text-2xl text-green">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
