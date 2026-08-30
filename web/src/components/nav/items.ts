export const NAV = [
  { to: "/play", id: "play", label: "PLAY", sub: "ENTER THE ARCHIVE" },
  { to: "/decks", id: "decks", label: "DECKS", sub: "BUILD YOUR DOSSIER" },
  { to: "/collection", id: "collection", label: "COLLECTION", sub: "UNCOVER THE RECORD" },
  { to: "/missions", id: "missions", label: "MISSIONS", sub: "CLASSIFIED OBJECTIVES" },
  { to: "/store", id: "store", label: "STORE", sub: "ANONYMOUS EXCHANGE" },
] as const;

export type NavId = (typeof NAV)[number]["id"];
