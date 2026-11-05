// Minimal footer — full four-column footer from the prototype ships when its
// destinations exist (TASK 4.5+). Branding note kept per D1.
export default function SiteFooter() {
  return (
    <footer className="mt-8 bg-nav pb-6 text-[#C9D8EE]">
      <div className="mx-auto max-w-[1100px] px-4 py-8 text-center text-sm">
        <p className="font-display text-lg font-bold text-white">
          Constro&nbsp;Well
        </p>
        <p className="mt-1">
          © 2026 Constro Well · Construction materials marketplace · MVP in
          development — the BuildGrid prototypes remain the approved design
          reference.
        </p>
      </div>
    </footer>
  );
}
