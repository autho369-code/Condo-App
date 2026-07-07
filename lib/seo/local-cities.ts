// Curated metro pages for /local — quality over quantity. Each city gets a
// unique market blurb and links to its state's /hoa-laws guide. Add cities
// only with genuinely local content; never ship boilerplate-only pages.

export type LocalCity = {
  slug: string
  city: string
  state: string
  abbr: string
  /** slug into /hoa-laws/[state] */
  stateSlug: string
  /** unique local market context — 2–3 sentences, no filler */
  blurb: string
}

export const LOCAL_CITIES: LocalCity[] = [
  {
    slug: 'chicago',
    city: 'Chicago',
    state: 'Illinois',
    abbr: 'IL',
    stateSlug: 'illinois',
    blurb:
      'Chicago is one of the largest condominium markets in the country — from lakefront high-rises on the Gold Coast to vintage walk-ups in Lincoln Park and Rogers Park. Associations here juggle the Illinois Condominium Property Act, Chicago’s own municipal disclosure ordinance (§ 13-72), and Section 22.1 resale disclosures on every sale.',
  },
  {
    slug: 'miami',
    city: 'Miami',
    state: 'Florida',
    abbr: 'FL',
    stateSlug: 'florida',
    blurb:
      'Post-Surfside, Miami condo boards face the toughest compliance load in America: milestone structural inspections (25 years within 3 miles of the coast), mandatory Structural Integrity Reserve Studies, and reserves that can no longer be waived. Managers here need airtight records, budgets, and owner communication.',
  },
  {
    slug: 'orlando',
    city: 'Orlando',
    state: 'Florida',
    abbr: 'FL',
    stateSlug: 'florida',
    blurb:
      'Orlando’s association market skews toward large master-planned HOA communities under Chapter 720, alongside a growing downtown condo stock under Chapter 718. High rental and vacation-home ratios make owner communication and violation workflows especially demanding.',
  },
  {
    slug: 'tampa',
    city: 'Tampa',
    state: 'Florida',
    abbr: 'FL',
    stateSlug: 'florida',
    blurb:
      'Tampa Bay combines fast-growing suburban HOAs with waterfront condo towers subject to Florida’s milestone inspection and SIRS mandates. Boards here manage hurricane-driven insurance volatility on top of standard Chapter 718/720 compliance.',
  },
  {
    slug: 'naples',
    city: 'Naples',
    state: 'Florida',
    abbr: 'FL',
    stateSlug: 'florida',
    blurb:
      'Naples has one of the highest concentrations of condominium and HOA residents in the U.S., with heavily seasonal occupancy. Associations need self-service owner portals and clean financial reporting for snowbird owners who are away half the year.',
  },
  {
    slug: 'phoenix',
    city: 'Phoenix',
    state: 'Arizona',
    abbr: 'AZ',
    stateSlug: 'arizona',
    blurb:
      'Phoenix’s planned communities operate under Arizona’s Planned Communities Act with some of the nation’s strictest open-meeting rules, and owners can take disputes to the Arizona Department of Real Estate instead of court. Documentation discipline matters here.',
  },
  {
    slug: 'scottsdale',
    city: 'Scottsdale',
    state: 'Arizona',
    abbr: 'AZ',
    stateSlug: 'arizona',
    blurb:
      'Scottsdale’s golf and resort communities carry high amenity budgets, architectural-control workloads, and short-term-rental friction. Arizona’s statutory caps on disclosure fees and open-meeting requirements shape how boards operate.',
  },
  {
    slug: 'dallas',
    city: 'Dallas',
    state: 'Texas',
    abbr: 'TX',
    stateSlug: 'texas',
    blurb:
      'Dallas-Fort Worth HOAs answer to Texas Property Code Chapter 209 — notice-and-cure before fines, statutory records deadlines, and county-filed management certificates. The metroplex’s sheer volume of single-family HOAs makes process automation the difference-maker.',
  },
  {
    slug: 'houston',
    city: 'Houston',
    state: 'Texas',
    abbr: 'TX',
    stateSlug: 'texas',
    blurb:
      'Houston famously has no zoning, so deed restrictions and HOA enforcement do the work zoning does elsewhere — with Chapter 209’s due-process rules governing every step. Flood-driven maintenance and insurance tracking add operational weight.',
  },
  {
    slug: 'austin',
    city: 'Austin',
    state: 'Texas',
    abbr: 'TX',
    stateSlug: 'texas',
    blurb:
      'Austin’s downtown condo boom and fast-growing suburban HOAs both live under Texas’s owner-protection statutes. High turnover and investor ownership make resale certificates (§ 207.003 and § 82.157) a constant workflow.',
  },
  {
    slug: 'denver',
    city: 'Denver',
    state: 'Colorado',
    abbr: 'CO',
    stateSlug: 'colorado',
    blurb:
      'Denver associations operate under CCIOA plus HB22-1137’s collection reforms — mandatory payment plans, capped interest, and restricted foreclosures — and must register annually with the state HOA office. Boards need clean ledgers and documented policies more than ever.',
  },
  {
    slug: 'las-vegas',
    city: 'Las Vegas',
    state: 'Nevada',
    abbr: 'NV',
    stateSlug: 'nevada',
    blurb:
      'Las Vegas associations answer to NRS 116, the state Ombudsman, per-unit state fees, and five-year reserve studies. Nevada’s super-priority lien history means lenders, buyers, and boards all scrutinize assessment accounting closely.',
  },
  {
    slug: 'atlanta',
    city: 'Atlanta',
    state: 'Georgia',
    abbr: 'GA',
    stateSlug: 'georgia',
    blurb:
      'Atlanta’s intown condo towers fall under the Georgia Condominium Act while its vast suburban HOAs weigh opting into the Property Owners’ Association Act for stronger lien rights. Covenant renewal deadlines are a uniquely Georgia trap for older neighborhoods.',
  },
  {
    slug: 'charlotte',
    city: 'Charlotte',
    state: 'North Carolina',
    abbr: 'NC',
    stateSlug: 'north-carolina',
    blurb:
      'Charlotte’s explosive growth keeps adding Chapter 47F planned communities, where fines require adjudicatory hearings and foreclosure follows strict statutory steps. Uptown’s condo towers run under Chapter 47C with resale certificates on every closing.',
  },
  {
    slug: 'seattle',
    city: 'Seattle',
    state: 'Washington',
    abbr: 'WA',
    stateSlug: 'washington',
    blurb:
      'Seattle communities created since mid-2018 fall under WUCIOA: owner-ratified budgets, reserve studies with tri-annual site visits, and records deadlines with per-day penalties. Older condos remain under RCW 64.34 — managers often run both regimes side by side.',
  },
  {
    slug: 'san-diego',
    city: 'San Diego',
    state: 'California',
    abbr: 'CA',
    stateSlug: 'california',
    blurb:
      'San Diego boards live inside Davis-Stirling’s machinery — triennial reserve studies, inspector-run elections, IDR offers — plus SB 326 balcony inspections for its huge stock of coastal condos. Compliance calendars here are unforgiving.',
  },
  {
    slug: 'los-angeles',
    city: 'Los Angeles',
    state: 'California',
    abbr: 'CA',
    stateSlug: 'california',
    blurb:
      'Los Angeles associations range from Wilshire Corridor high-rises to hillside PUDs, all under the Davis-Stirling Act’s disclosure, election, and reserve regime. Wildfire-driven insurance disruption has made budget transparency a board survival skill.',
  },
  {
    slug: 'san-francisco',
    city: 'San Francisco',
    state: 'California',
    abbr: 'CA',
    stateSlug: 'california',
    blurb:
      'San Francisco’s condo stock is dense with small self-managed associations and TIC conversions, where Davis-Stirling obligations fall on volunteer boards without professional staff. Clean books and automated notices matter disproportionately here.',
  },
  {
    slug: 'boston',
    city: 'Boston',
    state: 'Massachusetts',
    abbr: 'MA',
    stateSlug: 'massachusetts',
    blurb:
      'Boston condominiums — triple-deckers to Seaport towers — run under M.G.L. c. 183A, where the six-month super-lien makes precise, well-noticed assessment accounting a genuine financial weapon for associations.',
  },
  {
    slug: 'new-york',
    city: 'New York',
    state: 'New York',
    abbr: 'NY',
    stateSlug: 'new-york',
    blurb:
      'New York City condos operate under Real Property Law Article 9-B with AG-supervised offering plans, while Local Law 97 emissions caps now drive capital planning for many buildings. Bylaws carry the governance weight statutes carry elsewhere.',
  },
  {
    slug: 'philadelphia',
    city: 'Philadelphia',
    state: 'Pennsylvania',
    abbr: 'PA',
    stateSlug: 'pennsylvania',
    blurb:
      'Philadelphia associations run under Pennsylvania’s Uniform Condominium and Planned Community Acts, with mandatory resale certificates and five-day buyer rescission windows on every sale — a paperwork pipeline that rewards automation.',
  },
  {
    slug: 'minneapolis',
    city: 'Minneapolis',
    state: 'Minnesota',
    abbr: 'MN',
    stateSlug: 'minnesota',
    blurb:
      'Twin Cities communities under MCIOA must budget adequate replacement reserves by statute and deliver annual reports to owners. Freeze-thaw maintenance cycles make preventive-maintenance calendars core infrastructure, not a nice-to-have.',
  },
  {
    slug: 'washington-dc',
    city: 'Washington',
    state: 'D.C.',
    abbr: 'DC',
    stateSlug: 'washington-dc',
    blurb:
      'D.C. condominiums register offerings with DHCD and operate under the D.C. Condominium Act, whose six-month super-priority lien has produced some of the nation’s most consequential association-foreclosure case law. Resale packages are statutory.',
  },
  {
    slug: 'baltimore',
    city: 'Baltimore',
    state: 'Maryland',
    abbr: 'MD',
    stateSlug: 'maryland',
    blurb:
      'Baltimore associations operate under the Maryland Condominium Act and HOA Act, with 2022’s statewide reserve-study mandate forcing many older harbor-area and rowhouse-conversion communities to fund reserves formally for the first time.',
  },
  {
    slug: 'annapolis',
    city: 'Annapolis',
    state: 'Maryland',
    abbr: 'MD',
    stateSlug: 'maryland',
    blurb:
      'Annapolis’s waterfront condominiums and historic-district associations manage Maryland’s § 11-135 resale certificate process, five-year reserve studies, and marine-environment maintenance loads — a lot of statute for communities of modest size.',
  },
  {
    slug: 'honolulu',
    city: 'Honolulu',
    state: 'Hawaii',
    abbr: 'HI',
    stateSlug: 'hawaii',
    blurb:
      'Honolulu is among the most condo-dense cities in America. HRS 514B requires associations to fund 50% of replacement reserves or follow a funding plan, register biennially with the Real Estate Commission, and mediate many disputes before court.',
  },
  {
    slug: 'virginia-beach',
    city: 'Virginia Beach',
    state: 'Virginia',
    abbr: 'VA',
    stateSlug: 'virginia',
    blurb:
      'Virginia Beach communities register with the Common Interest Community Board and follow the 2023 Resale Disclosure Act’s unified certificate process. Coastal insurance and reserve-study review cycles shape board agendas here.',
  },
]

export function getCityBySlug(slug: string): LocalCity | undefined {
  return LOCAL_CITIES.find((c) => c.slug === slug)
}
