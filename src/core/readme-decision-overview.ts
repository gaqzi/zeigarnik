// The lines of the block in README.md's "Decision" section, under "The
// overview of a decision reads like this:". Unit tests cannot read files, so
// details.test.ts pins this literal to what show renders, and script/test
// holds README.md to it.
export const readmeDecisionOverview: string[] = [
  'D1 Decision: Which holiday do we book?',
  '   Decision: D1.3 Paphos',
  '   because (chat): Paphos then, the 20 min transfer settles it',
  '   Criteria: C1 Europe · C2 sea ≥ 18°C · C3 sunny · C4 good bars · C5 transfer ≤ 30 min (from T5)',
  '   Options:',
  '     · D1.1 Greek village',
  '         #1 claude: best beach of the lot, but 2h by bus from the airport (fails C5)',
  '     · D1.2 Costa del Sol',
  '         #1 claude: bars, easy flights; sea borderline for C2 in late May',
  '     ✓ D1.3 Paphos',
  '         #1 claude: warmest sea, short transfer; fewer bars than D1.2',
  '         ✓ T6 Check Paphos flights → direct, Thursday and Sunday',
]
