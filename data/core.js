/*
 * Silicon Valley genealogy: shared definitions. Load this before data/eras/*.js.
 *
 * eras: the bands drawn on the map. Each era has one file in data/eras/,
 *   named <from>-<to>-<id>.js, holding the companies founded in that era and
 *   every link into them. To add an era: add it here, create its file, add a
 *   <script> tag in index.html, and raise Graph.LAYOUT.lastYear if needed.
 *
 * Company format:
 *   { id, name, founded, ended?, sector, fate, note,
 *     founders: [{ n: person, f: company id or plain-text origin, s?: independent source }],
 *     sources: ["semi1984" | url, ...] }
 *   `ended` is the year the company stopped being independent (acquired or closed).
 *   `unconfirmed: true` marks an entry no independent source confirms, even if
 *   its other sources (cited in the note) discuss it.
 *   sector: chips, computers, networking, software, internet, games, vc, corporate, people.
 *
 * People: an important person who acts on their own — not through a company or
 *   fund, e.g. a personal angel investment — gets a node with sector "people".
 *   For people, `founded` is the year they first act independently on the map;
 *   links from their companies use type "alumni", and links to what they start
 *   or back use "founder" or "funding".
 *
 * Link format: { from, to, year, type, note, source } — `to` descends from `from`.
 *   type: spinout (founders left the parent to start it), alumni (a founder or
 *   key leader came from the parent), funding (the parent financed it),
 *   acquisition (formed from the parent's bought assets), founder (a person
 *   founded or co-founded it).
 *   source: a key from `sources` below, a URL, or an array of them.
 *
 * roots: where the trace stops. A company's panel shows its nearest root and
 *   every other root it descends from.
 *
 * Every company and every link must cite a source. Where sources disagree,
 * say so in the company's note and cite both. Sources marked posterFamily
 * (the 1984 poster and its author's other writing) do not count as
 * independent; entries backed only by them are flagged on the site.
 */
window.GENEALOGY = {
  eras: [
    { id: "roots", label: "Roots", from: null, to: 1954,
      summary: "Institutions and companies founded before Shockley's lab that supplied the Valley with people, money or ideas." },
    { id: "transistor", label: "The transistor", from: 1955, to: 1958,
      summary: "Shockley's laboratory and the eight engineers who left it to found Fairchild." },
    { id: "integrated-circuit", label: "The integrated circuit", from: 1959, to: 1967,
      summary: "Fairchild's first spin-outs, the first venture partnerships, and National Semiconductor's move west." },
    { id: "microprocessor", label: "Memory & the microprocessor", from: 1968, to: 1975,
      summary: "Intel, AMD and a wave of chip start-ups; Kleiner Perkins and Sequoia are founded." },
    { id: "personal-computer", label: "The personal computer", from: 1976, to: 1989,
      summary: "Apple, Oracle, Sun and Cisco, the later chip spin-outs, and the end of the SEMI poster's coverage in 1981." },
    { id: "dot-com", label: "The internet & the dot-com boom", from: 1990, to: 2001,
      summary: "From Netscape to Google, through the 2000–2001 bust." },
    { id: "web2-social", label: "Web 2.0 & social", from: 2002, to: 2007,
      summary: "PayPal's alumni scatter into new companies, Facebook moves to Palo Alto, and Y Combinator funds its first batches." },
    { id: "mobile-cloud", label: "Mobile & cloud", from: 2008, to: 2014,
      summary: "The App Store and the cloud: the sharing economy, developer platforms and a new generation of venture firms." }
  ],

  roots: [
    { id: "shockley", label: "Shockley Semiconductor", why: "The Valley's first silicon company and the source of the Fairchild family." },
    { id: "stanford", label: "Stanford University", why: "Its students and labs started HP, Sun, Cisco, Yahoo, Google and more." },
    { id: "hp", label: "Hewlett-Packard", why: "The Palo Alto garage company whose engineers and executives seeded many firms." },
    { id: "parc", label: "Xerox PARC", why: "The research lab behind Ethernet, laser printing and the graphical interface." },
    { id: "ampex", label: "Ampex", why: "The tape pioneer where the founders of Atari and Oracle worked." },
    { id: "uc-berkeley", label: "UC Berkeley", why: "The East Bay university whose alumni and labs fed Intel, Apple, Sun, VMware and Databricks." }
  ],

  sources: {
    semi1984: { short: "SEMI 1984 poster", title: "SEMI, “Silicon Valley Genealogy” poster (1984), developed by Don C. Hoefler",
      posterFamily: true },
    wolff1971: { short: "Wolff 1971",
      title: "Michael F. Wolff, “The Splintering of the Solid-State Electronics Industry” (1971), reprinted in Dealing with Technological Change (Auerbach, 1971)",
      url: "https://archive.org/details/isbn_9780877690832" },
    hoefler1971: { short: "Hoefler 1971", posterFamily: true,
      title: "Don C. Hoefler, “Silicon Valley U.S.A.”, Electronic News, January 1971 — the poster's author, so not independent of it",
      url: "https://archive.computerhistory.org/resources/access/text/2012/03/102689013-01-05-acc.pdf" }
  },

  companies: [],
  links: [],

  add: function (chunk) {
    Array.prototype.push.apply(this.companies, chunk.companies || []);
    Array.prototype.push.apply(this.links, chunk.links || []);
  }
};
