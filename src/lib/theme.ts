export const TEAM_COLORS = [
  { name: "Verde", value: "#43A27A" },
  { name: "Azul", value: "#3E7BFA" },
  { name: "Ciano", value: "#22B8CF" },
  { name: "Roxo", value: "#8B5CF6" },
  { name: "Rosa", value: "#E0569B" },
  { name: "Vermelho", value: "#E5484D" },
  { name: "Laranja", value: "#F07B2B" },
  { name: "Dourado", value: "#E7B23A" },
];

function luminance(hex: string) {
  const v = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Aplica a cor do time ao tema (e escolhe texto claro ou escuro sobre ela). */
export function applyTeamColor(color: string | undefined) {
  const root = document.documentElement;
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) {
    root.style.removeProperty("--accent");
    root.style.removeProperty("--on-accent");
    return;
  }
  root.style.setProperty("--accent", color);
  root.style.setProperty("--on-accent", luminance(color) > 0.28 ? "#07100c" : "#ffffff");
}
