/*
 * Roots (before 1955): Institutions and companies founded before Shockley's lab that fed people or money into the Valley.
 * Companies founded in this era, and every link into them.
 * Format and link types: see data/core.js.
 */
GENEALOGY.add({
  companies: [
    { id: "stanford", name: "Stanford University", founded: 1885, month: 11, sector: "corporate",
      fate: "Active (private research university)",
      note: "Founded in 1885 by Leland and Jane Stanford; opened to students in 1891. Engineering professor Frederick Terman mentored Bill Hewlett and David Packard and later created Stanford Industrial Park.",
      founders: [
        { n: "Leland Stanford", f: "" },
        { n: "Jane Stanford", f: "" }],
      sources: ["https://en.wikipedia.org/wiki/Stanford_University", "https://en.wikipedia.org/wiki/Frederick_Terman", "https://purl.stanford.edu/rb803rc6397"] },
    { id: "bell-labs", name: "Bell Telephone Laboratories", founded: 1925, month: 1, sector: "corporate",
      fate: "Now Nokia Bell Labs",
      note: "Walter Brattain, John Bardeen and William Shockley invented the transistor here in 1947.",
      founders: [
        { n: "AT&T / Western Electric", f: "" }],
      sources: ["semi1984", "https://en.wikipedia.org/wiki/Bell_Labs", "https://www.computerhistory.org/siliconengine/companies/"] },
    { id: "fairchild-camera", name: "Fairchild Camera and Instrument", founded: 1927, ended: 1979, sector: "corporate",
      fate: "Acquired by Schlumberger 1979",
      note: "Sherman Fairchild's company financed the Traitorous Eight and owned Fairchild Semiconductor.",
      founders: [
        { n: "Sherman Fairchild", f: "" }],
      sources: ["https://en.wikipedia.org/wiki/Fairchild_Camera_and_Instrument"] },
    { id: "beckman", name: "Beckman Instruments", founded: 1935, sector: "corporate",
      fate: "Now Beckman Coulter, part of Danaher since 2011",
      note: "Arnold Beckman bankrolled Shockley's laboratory as a division of his company.",
      founders: [
        { n: "Arnold Beckman", f: "" }],
      sources: ["https://en.wikipedia.org/wiki/Beckman_Coulter"] },
    { id: "hp", name: "Hewlett-Packard", founded: 1939, sector: "computers",
      fate: "Split into HP Inc. and Hewlett Packard Enterprise 2015",
      note: "The Palo Alto garage company. Not a Shockley descendant, but its people and money run all through the Valley.",
      founders: [
        { n: "Bill Hewlett", f: "" },
        { n: "Dave Packard", f: "" }],
      sources: ["https://en.wikipedia.org/wiki/Hewlett-Packard"] },
    { id: "ampex", name: "Ampex", founded: 1944, month: 11, ended: 2014, sector: "corporate",
      fate: "Ampex Data Systems sold to Delta Information Systems in 2014; still operates as a Delta subsidiary based in Hayward, California",
      note: "Magnetic-tape and videotape pioneer founded by Alexander Poniatoff. Atari founders Nolan Bushnell and Ted Dabney, and Oracle co-founders Larry Ellison, Bob Miner and Ed Oates all worked there.",
      founders: [
        { n: "Alexander M. Poniatoff", f: "Dalmo-Victor" }],
      sources: ["https://en.wikipedia.org/wiki/Ampex", "https://en.wikipedia.org/wiki/Nolan_Bushnell", "https://en.wikipedia.org/wiki/Larry_Ellison", "https://www.encyclopedia.com/books/politics-and-business-magazines/ampex-corporation"] }
  ],

  links: [
    { from: "stanford", to: "hp", year: 1939, type: "alumni", note: "Bill Hewlett and David Packard were Stanford electrical-engineering graduates mentored by professor Frederick Terman.",
      source: "https://en.wikipedia.org/wiki/Hewlett-Packard" }
  ]
});
