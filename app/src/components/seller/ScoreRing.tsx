// Delivery-score ring — port of buildgrid-seller-dashboard.html's `.ring`
// (conic-gradient, CSS line 71).
export default function ScoreRing({ score, color }: { score: number; color: string }) {
  return (
    <div
      className="relative grid h-24 w-24 flex-none place-items-center rounded-full"
      style={{ background: `conic-gradient(${color} calc(${score}*1%), var(--line) 0)` }}
    >
      <div className="absolute inset-[10px] rounded-full bg-panel" />
      <b className="relative font-display text-[30px] font-bold">{score}</b>
    </div>
  );
}
