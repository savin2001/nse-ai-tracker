/**
 * GradientBackground — animated floating colour orbs + dot grid.
 * Used on LandingPage and LoginPage. Renders fixed behind all content.
 */
export default function GradientBackground({ subtle = false }: { subtle?: boolean }) {
  const opacity = subtle ? 0.5 : 1;
  return (
    <div
      className="fixed inset-0 overflow-hidden pointer-events-none z-0"
      style={{ opacity }}
      aria-hidden
    >
      {/* Orb 1 — emerald, top-left */}
      <div
        className="absolute rounded-full"
        style={{
          top: "-15%", left: "5%",
          width: 700, height: 700,
          background: "radial-gradient(circle at center, rgba(16,185,129,0.08) 0%, transparent 70%)",
          animation: "orb-1 26s ease-in-out infinite",
        }}
      />
      {/* Orb 2 — purple, bottom-right */}
      <div
        className="absolute rounded-full"
        style={{
          bottom: "-15%", right: "5%",
          width: 600, height: 600,
          background: "radial-gradient(circle at center, rgba(139,92,246,0.08) 0%, transparent 70%)",
          animation: "orb-2 22s ease-in-out infinite",
        }}
      />
      {/* Orb 3 — blue, center */}
      <div
        className="absolute rounded-full"
        style={{
          top: "35%", left: "55%",
          width: 400, height: 400,
          background: "radial-gradient(circle at center, rgba(59,130,246,0.05) 0%, transparent 70%)",
          animation: "orb-3 32s ease-in-out infinite",
          transform: "translate(-50%, -50%)",
        }}
      />
      {/* Dot grid — masked to centre */}
      <div
        className="absolute inset-0 dot-grid"
        style={{
          maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 0%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 0%, transparent 100%)",
        }}
      />
    </div>
  );
}
