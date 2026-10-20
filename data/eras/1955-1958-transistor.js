/*
 * The transistor (1955–1958): Shockley's lab and the Traitorous Eight's Fairchild.
 * Companies founded in this era, and every link into them.
 * Format and link types: see data/core.js.
 */
GENEALOGY.add({
  companies: [
    { id: "shockley", name: "Shockley Semiconductor Laboratory", founded: 1956, month: 2, ended: 1968, sector: "chips",
      fate: "Sold to Clevite 1960, sold to ITT 1965, closed 1968",
      note: "The first silicon device company in the Valley. Shockley's management drove away his best people. Sources disagree on the founding year: Wikipedia gives 1955, when Shockley and Beckman agreed terms; the Computer History Museum dates the lab's founding to February 1956, which the map uses.",
      founders: [
        { n: "William Shockley", f: "bell-labs" }],
      sources: ["semi1984", "https://en.wikipedia.org/wiki/Shockley_Semiconductor_Laboratory", "https://www.computerhistory.org/siliconengine/companies/", "https://s3events.computerhistory.org/documents/The_Rise_of_Silicon_Valley_EventSummary.pdf"] },
    { id: "fairchild", name: "Fairchild Semiconductor", founded: 1957, month: 9, ended: 2016, sector: "chips",
      fate: "Sold to Schlumberger 1979; sold to National Semiconductor 1987; independent again 1997; acquired by ON Semiconductor 2016",
      note: "Founded by the “Traitorous Eight” who left Shockley. Hoerni's planar process and Noyce's integrated circuit were invented here, and dozens of companies spun out of it.",
      founders: [
        { n: "Robert Noyce", f: "shockley" },
        { n: "Gordon Moore", f: "shockley" },
        { n: "Jean Hoerni", f: "shockley" },
        { n: "Jay Last", f: "shockley" },
        { n: "Sheldon Roberts", f: "shockley" },
        { n: "Eugene Kleiner", f: "shockley" },
        { n: "Victor Grinich", f: "shockley" },
        { n: "Julius Blank", f: "shockley" }],
      sources: ["semi1984", "https://en.wikipedia.org/wiki/Fairchild_Semiconductor", "https://computerhistory.org/blog/fairchild-semiconductor-the-60th-anniversary-of-a-silicon-valley-legend/"] }
  ],

  links: [
    { from: "bell-labs", to: "shockley", year: 1956, type: "alumni", note: "William Shockley, co-inventor of the transistor, left Bell Labs in the mid-1950s and opened his own lab in 1956",
      source: "https://en.wikipedia.org/wiki/William_Shockley" },
    { from: "beckman", to: "shockley", year: 1956, type: "funding", note: "Arnold Beckman funds the lab as a division of Beckman Instruments (deal agreed 1955, lab opened 1956)",
      source: "https://www.computerhistory.org/siliconengine/companies/" },
    { from: "shockley", to: "fairchild", year: 1957, type: "spinout", note: "The “Traitorous Eight” resign from Shockley",
      source: ["semi1984","https://en.wikipedia.org/wiki/Traitorous_eight"] },
    { from: "fairchild-camera", to: "fairchild", year: 1957, type: "funding", note: "Fairchild Camera and Instrument backs the eight",
      source: "https://www.computerhistory.org/siliconengine/companies/" }
  ]
});
