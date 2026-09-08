// Konfigurierbares Typ-System fuer die Grid-Anforderungen.
// Neue Typen/Kategorien = einfach ein weiteres Objekt in dieses Array einfuegen.
const requirementTypes = [
  {
    id: "wins",
    category: "stat",
    labelTemplate: "{value}+ Siege",
    values: [1, 5, 10, 20, 50],
    check: (driver, value) => driver.wins >= value
  },
  {
    id: "starts",
    category: "stat",
    labelTemplate: "{value}+ Starts",
    values: [50, 100, 150, 200],
    check: (driver, value) => driver.starts >= value
  },
  {
    id: "podiums",
    category: "stat",
    labelTemplate: "{value}+ Podien",
    values: [5, 10, 25, 50],
    check: (driver, value) => driver.podiums >= value
  },
  {
    id: "dnfs",
    category: "stat",
    labelTemplate: "{value}+ DNFs",
    values: [5, 10, 20],
    check: (driver, value) => driver.dnfs >= value
  },
  {
    id: "careerPoints",
    category: "stat",
    labelTemplate: "{value}+ Karrierepunkte",
    values: [100, 500, 1000, 2000],
    check: (driver, value) => driver.careerPoints >= value
  },
  {
    id: "championships",
    category: "stat",
    labelTemplate: "Weltmeister ({value}x oder oefter)",
    values: [1, 2, 3],
    check: (driver, value) => driver.championships >= value
  },
  {
    id: "team",
    category: "team",
    labelTemplate: "Fuhr fuer {value}",
    values: null, // wird zur Laufzeit dynamisch aus drivers.json befuellt
    check: (driver, value) => driver.teams.includes(value),
    // Ein Fahrer kann fuer mehrere Teams gefahren sein: mehrere Team-Anforderungen
    // sind erlaubt und duerfen frei auf Zeilen UND Spalten gemischt vorkommen
    // (anders als bei "nation", siehe dort).
    allowMultipleAnyAxis: true
  },
  {
    id: "nation",
    category: "nation",
    labelTemplate: "Fahrer aus {value}",
    values: null, // wird zur Laufzeit dynamisch aus drivers.json befuellt
    check: (driver, value) => driver.nation === value,
    // Ein Fahrer hat nur eine Nation: mehrere Nation-Anforderungen sind erlaubt,
    // aber ausschliesslich auf einer Achse (nur Zeilen ODER nur Spalten) - siehe
    // drawRequirementsWithNationRule() in script.js.
    allowMultiple: true
  }
];
