// Statutory reference data for the /hoa-laws content hub.
// Facts are summaries of each state's community-association statutes for
// educational content — every page renders a "not legal advice" disclaimer.

export type StateLaw = {
  slug: string
  name: string
  abbr: string
  /** Primary condominium statute — name + citation */
  condoAct: string
  /** HOA / planned-community statute if separate from the condo act */
  hoaAct: string | null
  /** 2–3 sentence unique overview of how the state regulates associations */
  overview: string
  /** State-specific compliance points boards and managers must know */
  keyPoints: string[]
  /** Resale / disclosure requirement summary */
  resale: string
}

export const STATE_LAWS: StateLaw[] = [
  {
    slug: 'alabama',
    name: 'Alabama',
    abbr: 'AL',
    condoAct: 'Alabama Uniform Condominium Act (Ala. Code § 35-8A-101 et seq.)',
    hoaAct: 'Alabama Homeowners’ Association Act of 2015 (Ala. Code § 35-20-1 et seq.)',
    overview:
      'Alabama regulates condominiums created after 1991 under its Uniform Condominium Act, while homeowners’ associations formed after January 1, 2016 must organize as nonprofit corporations and file governing documents with the county probate judge under the 2015 HOA Act.',
    keyPoints: [
      'Post-2016 HOAs must record declarations and bylaws with the probate judge and file with the Secretary of State',
      'Condominium associations owe unit owners access to books and records on reasonable notice',
      'Assessment liens are enforceable against units, subject to statutory notice requirements',
    ],
    resale:
      'Condominium resales under the Uniform Condominium Act require a resale certificate covering assessments, fees, and the association’s financial condition.',
  },
  {
    slug: 'alaska',
    name: 'Alaska',
    abbr: 'AK',
    condoAct: 'Alaska Uniform Common Interest Ownership Act (AS 34.08.010 et seq.)',
    hoaAct: null,
    overview:
      'Alaska adopted the Uniform Common Interest Ownership Act (UCIOA), a single statute governing condominiums, planned communities, and cooperatives alike. It sets uniform rules for budgets, meetings, records, and resale disclosures across all common-interest communities.',
    keyPoints: [
      'One statute (AS 34.08) covers condos, HOAs, and co-ops uniformly',
      'Budgets must be ratified by owners — the board adopts, owners can reject at a meeting',
      'Owners have statutory rights to inspect association records',
    ],
    resale:
      'Sellers must furnish a resale certificate with assessments, capital expenditures, reserves, insurance, and pending litigation (AS 34.08.590).',
  },
  {
    slug: 'arizona',
    name: 'Arizona',
    abbr: 'AZ',
    condoAct: 'Arizona Condominium Act (A.R.S. § 33-1201 et seq.)',
    hoaAct: 'Arizona Planned Communities Act (A.R.S. § 33-1801 et seq.)',
    overview:
      'Arizona regulates condominiums and planned communities under parallel statutes with some of the country’s strongest open-meeting rules. The Arizona Department of Real Estate runs an administrative process for owner-association disputes, giving owners an alternative to court.',
    keyPoints: [
      'Board meetings must be open to all members, with limited executive-session exceptions',
      'Statutory caps on late fees and strict assessment-lien procedures',
      'Rental regulations are limited — associations cannot prohibit rentals outright absent declaration authority',
      'Owner disputes can be filed with the ADRE administrative-hearing process',
    ],
    resale:
      'Resales require a disclosure package including assessments, insurance, litigation, and financials; fees for the package are capped by statute (A.R.S. § 33-1260, § 33-1806).',
  },
  {
    slug: 'arkansas',
    name: 'Arkansas',
    abbr: 'AR',
    condoAct: 'Arkansas Horizontal Property Act (Ark. Code Ann. § 18-13-101 et seq.)',
    hoaAct: null,
    overview:
      'Arkansas condominiums operate under the Horizontal Property Act, one of the older condo frameworks in the country, supplemented by nonprofit-corporation law for most HOAs. Governing documents carry heavy weight since the statute is comparatively thin.',
    keyPoints: [
      'The Horizontal Property Act governs creation, common elements, and assessments for condos',
      'Most HOAs are governed primarily by their recorded covenants and the Nonprofit Corporation Act',
      'Assessment liens attach under the act and are foreclosable',
    ],
    resale:
      'No comprehensive statutory resale certificate — buyers rely on recorded declarations and association-provided statements of account.',
  },
  {
    slug: 'california',
    name: 'California',
    abbr: 'CA',
    condoAct: 'Davis-Stirling Common Interest Development Act (Cal. Civ. Code § 4000 et seq.)',
    hoaAct: null,
    overview:
      'California’s Davis-Stirling Act is the most detailed community-association statute in the nation, covering condos, planned developments, and stock cooperatives. It mandates annual budget reports, reserve studies, election inspectors, and strict due-process rules for discipline and assessments.',
    keyPoints: [
      'Reserve study required at least every three years with annual funding disclosures (Civ. Code § 5550)',
      'Annual budget report and policy statement must go to all owners in a prescribed format',
      'Elections require independent inspectors, secret ballots, and statutory timelines',
      'Discipline and fining require notice and hearing; internal dispute resolution (IDR) must be offered',
      'SB 326 mandates balcony/elevated-element inspections for condos every 9 years',
    ],
    resale:
      'Sellers must deliver an extensive statutory disclosure package (Civ. Code § 4525) with governing documents, financials, reserves, and any construction-defect information; fee caps apply.',
  },
  {
    slug: 'colorado',
    name: 'Colorado',
    abbr: 'CO',
    condoAct: 'Colorado Common Interest Ownership Act — CCIOA (C.R.S. § 38-33.3-101 et seq.)',
    hoaAct: null,
    overview:
      'Colorado’s CCIOA governs condos and HOAs together and has been amended aggressively in recent years — HB22-1137 tightened collections, fining, and foreclosure practices, and associations must register annually with the Division of Real Estate’s HOA Information Office.',
    keyPoints: [
      'Annual registration with the Colorado HOA Information and Resource Center is mandatory',
      'HB22-1137 requires payment plans before foreclosure and caps certain fines and interest',
      'Owner education: associations must adopt responsible-governance policies (9 mandatory policies)',
      'Budget ratification by owners is required after board adoption',
    ],
    resale:
      'Resale requires a status letter/disclosure with assessments, violations, and financial obligations; CCIOA caps the fee associations may charge for it.',
  },
  {
    slug: 'connecticut',
    name: 'Connecticut',
    abbr: 'CT',
    condoAct: 'Connecticut Common Interest Ownership Act (Conn. Gen. Stat. § 47-200 et seq.)',
    hoaAct: null,
    overview:
      'Connecticut adopted UCIOA as its Common Interest Ownership Act, applying one comprehensive statute to condos, planned communities, and co-ops, with strong owner-meeting, budget-ratification, and record-access rights.',
    keyPoints: [
      'Owners ratify budgets; special assessments above thresholds need owner approval',
      'Detailed statutory rules for executive sessions and open board meetings',
      'Records access is a statutory right with limited confidentiality exceptions',
    ],
    resale:
      'Resale certificates are mandatory (C.G.S. § 47-270) covering assessments, reserves, capital plans, insurance, and litigation.',
  },
  {
    slug: 'delaware',
    name: 'Delaware',
    abbr: 'DE',
    condoAct: 'Delaware Uniform Common Interest Ownership Act — DUCIOA (25 Del. C. ch. 81)',
    hoaAct: null,
    overview:
      'Delaware’s DUCIOA modernized the state’s older Unit Property Act for communities created after 2009 and layers meeting, budget, and disclosure obligations onto pre-existing communities. The Delaware Ombudsperson’s office assists owners with association disputes.',
    keyPoints: [
      'Common Interest Community Ombudsperson provides a state-level dispute resource',
      'Budgets require owner ratification procedures under DUCIOA',
      'Pre-2009 communities are partially grandfathered but subject to key DUCIOA sections',
    ],
    resale:
      'Resale certificates with assessments, reserves, and financial statements are required for units in DUCIOA communities (25 Del. C. § 81-409).',
  },
  {
    slug: 'florida',
    name: 'Florida',
    abbr: 'FL',
    condoAct: 'Florida Condominium Act (Fla. Stat. ch. 718)',
    hoaAct: 'Florida Homeowners’ Association Act (Fla. Stat. ch. 720)',
    overview:
      'Florida is the most heavily regulated association market in the country. Post-Surfside legislation (SB 4-D, SB 154, HB 1021) imposed milestone structural inspections and mandatory Structural Integrity Reserve Studies (SIRS) on condos three stories and taller, ended reserve waivers for structural items, and added officer accountability rules enforced by the DBPR.',
    keyPoints: [
      'Milestone structural inspections at 30 years (25 in some coastal areas), then every 10 years',
      'SIRS reserve study every 10 years; structural reserves can no longer be waived',
      'DBPR Division of Condominiums regulates condos; arbitration program for disputes',
      'HB 1021 (2024) added criminal penalties for certain officer misconduct and records violations',
      'Ch. 720 HOAs: recorded amendments, statutory meeting notices, and fining committees required',
    ],
    resale:
      'Condo resales require the Q&A sheet, financials, governing documents, and — for 3+ story buildings — milestone inspection and SIRS summaries (Fla. Stat. § 718.503); HOA resales require a disclosure summary under § 720.401.',
  },
  {
    slug: 'georgia',
    name: 'Georgia',
    abbr: 'GA',
    condoAct: 'Georgia Condominium Act (O.C.G.A. § 44-3-70 et seq.)',
    hoaAct: 'Georgia Property Owners’ Association Act (O.C.G.A. § 44-3-220 et seq.)',
    overview:
      'Georgia condominiums fall under the Condominium Act automatically, while HOAs may opt in to the Property Owners’ Association Act (POAA) for stronger lien and collection powers — otherwise they are governed by their covenants and general corporate law.',
    keyPoints: [
      'POAA opt-in gives HOAs automatic statutory liens and attorney-fee recovery',
      'Condo assessment liens arise automatically under the Condominium Act',
      'Covenants in non-POAA communities can expire under Georgia’s covenant sunset rules unless renewed',
    ],
    resale:
      'Georgia has no universal statutory resale certificate; buyers obtain closing letters/statements of account from the association, and condo declarations commonly require them.',
  },
  {
    slug: 'hawaii',
    name: 'Hawaii',
    abbr: 'HI',
    condoAct: 'Hawaii Condominium Property Act (Haw. Rev. Stat. ch. 514B)',
    hoaAct: 'Planned Community Associations Act (Haw. Rev. Stat. ch. 421J)',
    overview:
      'Hawaii regulates condos under one of the more prescriptive statutes outside the mainland, with a state Real Estate Commission condominium program, mandatory reserve funding rules, and a condominium dispute-resolution pilot.',
    keyPoints: [
      'Associations must fund at least 50% of estimated replacement reserves or use a funding plan (HRS § 514B-148)',
      'Biennial registration with the Hawaii Real Estate Commission',
      'Mediation is required for many owner-association disputes before litigation',
    ],
    resale:
      'Sellers must deliver an extensive disclosure package (HRS § 514B-56) including reserves, budgets, house rules, and insurance summaries.',
  },
  {
    slug: 'idaho',
    name: 'Idaho',
    abbr: 'ID',
    condoAct: 'Idaho Condominium Property Act (Idaho Code § 55-1501 et seq.)',
    hoaAct: 'Idaho Homeowner’s Association Act (Idaho Code § 55-115)',
    overview:
      'Idaho pairs an older Condominium Property Act with a short but pointed HOA statute that limits fines, requires budget transparency, and restricts associations from banning political signs or solar installations in defined cases.',
    keyPoints: [
      'Fines require prior written notice and a majority board vote; no fines for aesthetic-only violations without authority',
      'Annual meeting financial disclosures are mandatory for HOAs',
      'Restrictions on prohibiting rentals added by recent amendments require declaration authority',
    ],
    resale:
      'No comprehensive statutory resale certificate; associations provide payoff/estoppel letters per governing documents.',
  },
  {
    slug: 'illinois',
    name: 'Illinois',
    abbr: 'IL',
    condoAct: 'Illinois Condominium Property Act (765 ILCS 605)',
    hoaAct: 'Common Interest Community Association Act — CICAA (765 ILCS 160)',
    overview:
      'Illinois — home to one of the largest condo markets in the U.S. — governs condominiums under the Condominium Property Act and non-condo communities under CICAA. Chicago layers its own ordinance on top, and the Condominium and Common Interest Community Ombudsperson Act provides a state complaint resource.',
    keyPoints: [
      'Boards must maintain reasonable reserves (765 ILCS 605/9(c)) and adopt budgets with owner notice',
      'Owners may inspect records; 2022 amendments tightened production deadlines (10 business days)',
      'Special assessments above statutory thresholds can be challenged by owner petition',
      'Chicago’s municipal code adds disclosure duties (§ 13-72) for units within the city',
      'Section 22.1 disclosures are mandatory on resale',
    ],
    resale:
      'Resales require the Section 22.1 disclosure (765 ILCS 605/22.1): declaration, bylaws, rules, financial statements, reserves, litigation, and anticipated capital expenditures; fees to produce it are capped at reasonable cost.',
  },
  {
    slug: 'indiana',
    name: 'Indiana',
    abbr: 'IN',
    condoAct: 'Indiana Condominium Act (Ind. Code § 32-25)',
    hoaAct: 'Indiana Homeowners Association Act (Ind. Code § 32-25.5)',
    overview:
      'Indiana maintains separate condo and HOA statutes with practical governance rules — HOA boards must provide annual financial statements on request, and both statutes include owner-meeting and proxy protections.',
    keyPoints: [
      'HOAs must make yearly financial statements available to members',
      'Grievance resolution: owners may compel meetings with the board over disputes',
      'Statutory protections for owner display of the U.S. flag and solar consideration',
    ],
    resale:
      'No universal resale certificate statute; condo declarations typically require statements of assessments for closing.',
  },
  {
    slug: 'iowa',
    name: 'Iowa',
    abbr: 'IA',
    condoAct: 'Iowa Horizontal Property Regimes Act (Iowa Code ch. 499B)',
    hoaAct: null,
    overview:
      'Iowa condominiums are organized as horizontal property regimes under chapter 499B, a lean statute that leaves most governance to the declaration and bylaws; HOAs operate under nonprofit-corporation law and recorded covenants.',
    keyPoints: [
      'Declaration and bylaws control most governance questions — draft them carefully',
      'Statute addresses creation, common elements, assessments, and lien rights',
      'Nonprofit corporation law (ch. 504) supplies meeting and records rules for most associations',
    ],
    resale:
      'No statutory resale certificate; buyers rely on recorded documents and association payoff statements.',
  },
  {
    slug: 'kansas',
    name: 'Kansas',
    abbr: 'KS',
    condoAct: 'Kansas Apartment Ownership Act (K.S.A. 58-3101 et seq.)',
    hoaAct: 'Kansas Uniform Common Interest Owners Bill of Rights Act (K.S.A. 58-4601 et seq.)',
    overview:
      'Kansas layers the Uniform Common Interest Owners Bill of Rights Act (KUCIOBORA) over older condo law, giving owners in most communities statutory rights to open meetings, records, budgets, and fair fining procedures.',
    keyPoints: [
      'Open board meetings and owner comment rights under KUCIOBORA',
      'Fining requires notice and opportunity to be heard',
      'Annual budget adoption with owner ratification mechanics',
    ],
    resale:
      'Resale certificates with assessment and financial information are required for communities covered by KUCIOBORA (K.S.A. 58-4616).',
  },
  {
    slug: 'kentucky',
    name: 'Kentucky',
    abbr: 'KY',
    condoAct: 'Kentucky Condominium Act (KRS § 381.9101 et seq.)',
    hoaAct: null,
    overview:
      'Kentucky’s Condominium Act (based on the Uniform Condominium Act) governs condos created after 2011, with earlier regimes under the Horizontal Property Law; HOAs rely on covenants and nonprofit law.',
    keyPoints: [
      'Post-2011 condos get UCA-style budget, meeting, and lien rules',
      'Associations hold statutory liens for assessments with limited priority',
      'Records and meeting rights apply to unit owners under the act',
    ],
    resale:
      'Resale certificates are required for post-2011 condominiums (KRS § 381.9203), covering assessments, judgments, and insurance.',
  },
  {
    slug: 'louisiana',
    name: 'Louisiana',
    abbr: 'LA',
    condoAct: 'Louisiana Condominium Act (La. R.S. 9:1121.101 et seq.)',
    hoaAct: 'Louisiana Homeowners Association Act (La. R.S. 9:1141.1 et seq.)',
    overview:
      'Louisiana’s civil-law tradition shapes its Condominium Act and a separate HOA Act that validates recorded community documents as building restrictions enforceable as real rights.',
    keyPoints: [
      'HOA Act gives recorded restrictions the force of real rights running with the land',
      'Condominium associations hold privilege (lien) rights for unpaid assessments',
      'Governing documents dominate — statutory governance provisions are minimal',
    ],
    resale:
      'No comprehensive statutory resale package; associations furnish assessment statements per documents.',
  },
  {
    slug: 'maine',
    name: 'Maine',
    abbr: 'ME',
    condoAct: 'Maine Condominium Act (33 M.R.S. § 1601-101 et seq.)',
    hoaAct: null,
    overview:
      'Maine adopted the Uniform Condominium Act for condominiums created after 1983, providing standard rules on declarations, budgets, meetings, and warranties; older regimes remain under the Unit Ownership Act.',
    keyPoints: [
      'UCA-style budget adoption and owner meetings',
      'Statutory warranty protections on new construction condos',
      'Assessment liens with statutory enforcement procedures',
    ],
    resale:
      'Resale certificates are mandatory (33 M.R.S. § 1604-108) with assessments, reserves, insurance, and litigation.',
  },
  {
    slug: 'maryland',
    name: 'Maryland',
    abbr: 'MD',
    condoAct: 'Maryland Condominium Act (Md. Code, Real Prop. § 11-101 et seq.)',
    hoaAct: 'Maryland Homeowners Association Act (Md. Code, Real Prop. § 11B)',
    overview:
      'Maryland closely regulates both condos and HOAs, and 2022 reforms (HB 107, post-Surfside) require reserve studies and funding for associations statewide. Montgomery County adds its own Commission on Common Ownership Communities for dispute resolution.',
    keyPoints: [
      'Reserve study every 5 years with mandatory funding of recommendations (2022 law)',
      'Open meetings, records access, and closed-session limits under both acts',
      'Montgomery County CCOC provides binding dispute resolution for many communities',
      'Fidelity insurance and annual proposed-budget delivery are required',
    ],
    resale:
      'Condo resales require the § 11-135 resale certificate package (contract rescission rights attach); HOA resales require an MHAA disclosure under § 11B-106.',
  },
  {
    slug: 'massachusetts',
    name: 'Massachusetts',
    abbr: 'MA',
    condoAct: 'Massachusetts Condominium Act (M.G.L. c. 183A)',
    hoaAct: null,
    overview:
      'Massachusetts condominiums operate under chapter 183A, a framework statute the courts treat as enabling rather than exhaustive — organizational documents control most governance, and the state’s super-lien gives associations six months of assessment priority over first mortgages.',
    keyPoints: [
      'Six-month priority "super-lien" for unpaid common charges (with proper notices)',
      'Trustee/organization documents control meetings and voting — statute is minimal',
      'Phased and mixed-use condos are common; documents must address them explicitly',
    ],
    resale:
      'The 6(d) certificate showing unpaid common charges is the standard closing document (M.G.L. c. 183A § 6(d)).',
  },
  {
    slug: 'michigan',
    name: 'Michigan',
    abbr: 'MI',
    condoAct: 'Michigan Condominium Act (MCL 559.101 et seq., Act 59 of 1978)',
    hoaAct: null,
    overview:
      'Michigan’s Condominium Act and its administrative rules require condo associations to maintain reserves of at least 10% of the annual budget and give co-owners audit, records, and meeting rights; HOAs are covenant- and nonprofit-law-driven.',
    keyPoints: [
      'Minimum reserve fund of 10% of current annual budget (admin rules)',
      'Annual financial statements and audit/review thresholds for larger associations',
      'Statutory arbitration option for disputes under the act',
    ],
    resale:
      'No statutory resale certificate for existing units; buyers receive recorded master deed/bylaws and association statements per documents.',
  },
  {
    slug: 'minnesota',
    name: 'Minnesota',
    abbr: 'MN',
    condoAct: 'Minnesota Common Interest Ownership Act — MCIOA (Minn. Stat. ch. 515B)',
    hoaAct: null,
    overview:
      'Minnesota’s MCIOA governs condos and most post-1994 planned communities under one statute, with mandatory replacement-reserve budgeting and detailed disclosure duties.',
    keyPoints: [
      'Budgets must include adequate replacement reserves (§ 515B.3-114)',
      'Annual reports to owners with financial and insurance summaries',
      'Statutory warranties on new construction; strict lien procedures',
    ],
    resale:
      'Resale disclosure certificates are mandatory (§ 515B.4-107) covering assessments, reserves, insurance, and litigation.',
  },
  {
    slug: 'mississippi',
    name: 'Mississippi',
    abbr: 'MS',
    condoAct: 'Mississippi Condominium Law (Miss. Code Ann. § 89-9-1 et seq.)',
    hoaAct: null,
    overview:
      'Mississippi’s condominium law is a horizontal-property-style statute; associations otherwise operate under their declarations and nonprofit-corporation law, making document quality decisive.',
    keyPoints: [
      'Statute covers creation, common elements, and assessment liens',
      'Governance details (meetings, records, fining) come from governing documents',
      'Nonprofit law supplies default meeting and voting rules',
    ],
    resale:
      'No statutory resale certificate; associations provide account statements per documents.',
  },
  {
    slug: 'missouri',
    name: 'Missouri',
    abbr: 'MO',
    condoAct: 'Missouri Uniform Condominium Act (Mo. Rev. Stat. ch. 448, § 448.1-101 et seq.)',
    hoaAct: null,
    overview:
      'Missouri applies the Uniform Condominium Act to condos created after 1983 (older ones under the prior Condominium Property Act), with standard UCA budget, meeting, records, and resale rules; HOAs are covenant-based.',
    keyPoints: [
      'UCA budget adoption and owner-meeting rules for post-1983 condos',
      'Statutory assessment lien with foreclosure remedies',
      'Records inspection rights for unit owners',
    ],
    resale:
      'Resale certificates are required for UCA condominiums (§ 448.4-109) with assessments, reserves, and insurance.',
  },
  {
    slug: 'montana',
    name: 'Montana',
    abbr: 'MT',
    condoAct: 'Montana Unit Ownership Act (Mont. Code Ann. § 70-23-101 et seq.)',
    hoaAct: 'Mont. Code Ann. § 70-17-901 et seq. (HOA restrictions)',
    overview:
      'Montana condominiums are governed by the Unit Ownership Act, and 2019/2021 legislation limited HOA power to impose new restrictions on existing owners without consent, a notable owner-rights stance.',
    keyPoints: [
      'Unit Ownership Act covers creation, common elements, and assessments',
      'SB 300-era limits: new covenants generally can’t bind non-consenting existing owners',
      'Documents and nonprofit law control day-to-day governance',
    ],
    resale:
      'No comprehensive statutory resale certificate; associations issue assessment statements per documents.',
  },
  {
    slug: 'nebraska',
    name: 'Nebraska',
    abbr: 'NE',
    condoAct: 'Nebraska Condominium Act (Neb. Rev. Stat. § 76-825 et seq.)',
    hoaAct: null,
    overview:
      'Nebraska’s Condominium Act (Uniform Condominium Act-based) governs condos created after 1984 with standard budget, records, and lien provisions; HOAs rely on covenants and nonprofit law.',
    keyPoints: [
      'UCA-style governance for post-1984 condominiums',
      'Statutory liens for assessments with priority rules',
      'Owner meeting and records rights under the act',
    ],
    resale:
      'Resale certificates are required for UCA condos (§ 76-885) covering assessments and association finances.',
  },
  {
    slug: 'nevada',
    name: 'Nevada',
    abbr: 'NV',
    condoAct: 'Nevada Common-Interest Ownership Act (NRS ch. 116)',
    hoaAct: null,
    overview:
      'Nevada regulates all common-interest communities under NRS 116 with an unusually strong administrative apparatus: the Real Estate Division’s CIC program, a state Ombudsman, mandatory reserve studies every five years, and a super-priority assessment lien that survived to national attention in the foreclosure era.',
    keyPoints: [
      'Reserve study every 5 years with annual review and funding disclosure (NRS 116.31152)',
      'Associations register with the state and pay per-unit fees; Ombudsman handles complaints',
      'Super-priority lien: portion of assessments primes first deeds of trust',
      'Board member education and election rules are statutorily prescribed',
    ],
    resale:
      'Resale packages (NRS 116.4109) with the "Information Statement," budgets, reserves, and violations are mandatory, with statutory fee caps.',
  },
  {
    slug: 'new-hampshire',
    name: 'New Hampshire',
    abbr: 'NH',
    condoAct: 'New Hampshire Condominium Act (RSA 356-B)',
    hoaAct: null,
    overview:
      'New Hampshire condominiums operate under RSA 356-B, a Virginia-style condominium act with registration of new projects through the Attorney General’s consumer protection bureau.',
    keyPoints: [
      'New condo offerings register with the AG’s office (public offering statements)',
      'Statutory lien rights and owner meeting requirements',
      'Documents control most operational governance',
    ],
    resale:
      'Resale disclosures per RSA 356-B:58-a include assessments and association financial condition.',
  },
  {
    slug: 'new-jersey',
    name: 'New Jersey',
    abbr: 'NJ',
    condoAct: 'New Jersey Condominium Act (N.J.S.A. 46:8B-1 et seq.)',
    hoaAct: 'Planned Real Estate Development Full Disclosure Act — PREDFDA (N.J.S.A. 45:22A-21 et seq.)',
    overview:
      'New Jersey combines its Condominium Act with PREDFDA and the 2017 "Radburn" election regulations, which impose detailed board-election, bylaws-amendment, and open-meeting requirements on nearly all common-interest communities via the DCA.',
    keyPoints: [
      'Radburn regulations: strict election notice, nomination, and ballot rules enforced by DCA',
      'Open board meetings with limited closed-session topics; minutes must be available',
      'ADR must be offered for owner disputes (Condo Act § 46:8B-14(k))',
      'Structural inspection & reserve legislation (2024, S2760) added post-Surfside obligations',
    ],
    resale:
      'Associations issue status letters for closing; PREDFDA governs disclosures on developer sales, and 2024 reserve legislation adds capital-plan transparency.',
  },
  {
    slug: 'new-mexico',
    name: 'New Mexico',
    abbr: 'NM',
    condoAct: 'New Mexico Condominium Act (NMSA § 47-7A-1 et seq.)',
    hoaAct: 'New Mexico Homeowner Association Act (NMSA § 47-16-1 et seq.)',
    overview:
      'New Mexico pairs a UCA-based Condominium Act with a 2013 HOA Act that mandates recorded notices of association existence, records access, and lien-notice safeguards for homeowners.',
    keyPoints: [
      'HOAs must record a notice identifying the association and contacts',
      'Records requests must be honored within statutory windows',
      'Lien enforcement requires pre-filing notice to owners',
    ],
    resale:
      'Condo resales require UCA-style certificates (§ 47-7D-9); HOA disclosure certificates are required under the HOA Act on sale.',
  },
  {
    slug: 'new-york',
    name: 'New York',
    abbr: 'NY',
    condoAct: 'New York Condominium Act (Real Property Law art. 9-B)',
    hoaAct: null,
    overview:
      'New York regulates condominium creation through the Condominium Act and — uniquely — polices offerings through the Attorney General under the Martin Act, with co-ops governed separately by corporate law. Governance detail lives largely in bylaws rather than statute.',
    keyPoints: [
      'New offerings require AG-accepted offering plans (Martin Act oversight)',
      'Common-charge liens are subordinate to first mortgages — collection strategy matters',
      'Business Judgment Rule (Levandusky) governs judicial review of board decisions',
      'NYC adds local requirements (e.g., Local Law 97 emissions compliance for many buildings)',
    ],
    resale:
      'No statutory resale certificate; managing agents issue status letters, and offering-plan amendments carry disclosure duties on sponsor sales.',
  },
  {
    slug: 'north-carolina',
    name: 'North Carolina',
    abbr: 'NC',
    condoAct: 'North Carolina Condominium Act (N.C.G.S. ch. 47C)',
    hoaAct: 'North Carolina Planned Community Act (N.C.G.S. ch. 47F)',
    overview:
      'North Carolina’s twin uniform acts (47C condos, 47F planned communities) give post-1986/1999 communities standardized governance, fining with hearings, and foreclosure procedures that follow the power-of-sale framework.',
    keyPoints: [
      'Fines require notice and hearing before an adjudicatory panel ($100/day cap default)',
      'Assessment lien foreclosures follow strict statutory steps',
      'Older communities can opt in to the uniform acts by amendment',
    ],
    resale:
      'Condo resales require certificates under § 47C-4-109; planned-community sellers provide statements of unpaid assessments.',
  },
  {
    slug: 'north-dakota',
    name: 'North Dakota',
    abbr: 'ND',
    condoAct: 'North Dakota Condominium Ownership of Real Property (N.D.C.C. ch. 47-04.1)',
    hoaAct: null,
    overview:
      'North Dakota’s condominium chapter is a concise horizontal-property statute; most governance flows from declarations, bylaws, and the Nonprofit Corporations Act.',
    keyPoints: [
      'Statute addresses creation, common areas, and assessment obligations',
      'Governing documents control meetings, voting, and enforcement',
      'Nonprofit law supplies default corporate governance',
    ],
    resale:
      'No statutory resale certificate; associations provide assessment statements per documents.',
  },
  {
    slug: 'ohio',
    name: 'Ohio',
    abbr: 'OH',
    condoAct: 'Ohio Condominium Act (Ohio Rev. Code ch. 5311)',
    hoaAct: 'Ohio Planned Community Law (Ohio Rev. Code ch. 5312)',
    overview:
      'Ohio regulates condos under chapter 5311 and planned communities under chapter 5312 (2010), which together require budgets, records access, fair fining with hearings, and recorded governing documents.',
    keyPoints: [
      'Ch. 5312 requires notice and hearing before enforcement assessments/fines',
      'Owners have records inspection rights in both regimes',
      'Condo conversions and new offerings carry statutory disclosure duties',
    ],
    resale:
      'No universal resale certificate, but condo sellers must furnish governing documents and recent financial statements on request (§ 5311.09 records duties support closing letters).',
  },
  {
    slug: 'oklahoma',
    name: 'Oklahoma',
    abbr: 'OK',
    condoAct: 'Oklahoma Unit Ownership Estate Act (60 O.S. § 501 et seq.)',
    hoaAct: 'Oklahoma Real Estate Development Act (60 O.S. § 851 et seq.)',
    overview:
      'Oklahoma condominiums operate under the Unit Ownership Estate Act, with HOAs under the Real Estate Development Act; both are lean statutes that defer heavily to recorded documents.',
    keyPoints: [
      'Unit Ownership Estate Act covers creation, common elements, and liens',
      'REDA authorizes HOA assessments and lien enforcement for planned developments',
      'Governance detail comes from declarations and nonprofit law',
    ],
    resale:
      'No statutory resale package; associations issue assessment/estoppel statements per documents.',
  },
  {
    slug: 'oregon',
    name: 'Oregon',
    abbr: 'OR',
    condoAct: 'Oregon Condominium Act (ORS ch. 100)',
    hoaAct: 'Oregon Planned Community Act (ORS ch. 94)',
    overview:
      'Oregon’s Condominium and Planned Community Acts both mandate reserve studies and reserve accounts for components the association maintains, open meetings, and detailed turnover procedures from declarant control.',
    keyPoints: [
      'Reserve study and reserve account required (ORS 100.175 / 94.595), reviewed annually',
      'Open meetings with owner notice; executive sessions limited',
      'Annual financial statement distribution to owners',
    ],
    resale:
      'Condo resales require disclosure statements (ORS 100.645); planned communities provide similar seller/association disclosures under ORS 94.',
  },
  {
    slug: 'pennsylvania',
    name: 'Pennsylvania',
    abbr: 'PA',
    condoAct: 'Pennsylvania Uniform Condominium Act (68 Pa. C.S. § 3101 et seq.)',
    hoaAct: 'Pennsylvania Uniform Planned Community Act (68 Pa. C.S. § 5101 et seq.)',
    overview:
      'Pennsylvania’s parallel uniform acts govern condos (post-1980) and planned communities (post-1997), with 2018 amendments adding alternative dispute resolution and bylaw transparency requirements.',
    keyPoints: [
      'UCA/UPCA budget adoption, meetings, and records rights',
      'Complaint procedures and ADR provisions added by Act 17 of 2018',
      'Statutory limited warranty on new condo construction',
    ],
    resale:
      'Resale certificates are mandatory (68 Pa. C.S. § 3407 / § 5407) with assessments, capital expenditures, reserves, and litigation; buyers get a 5-day rescission window.',
  },
  {
    slug: 'rhode-island',
    name: 'Rhode Island',
    abbr: 'RI',
    condoAct: 'Rhode Island Condominium Act (R.I.G.L. § 34-36.1-1.01 et seq.)',
    hoaAct: null,
    overview:
      'Rhode Island adopted the Uniform Condominium Act for condos created after 1982, with standard governance, budget, and resale rules; earlier condos remain under the prior Condominium Ownership Act.',
    keyPoints: [
      'UCA-style meetings, budgets, and records for post-1982 condos',
      'Statutory assessment lien with defined priority',
      'Public offering statements for new projects',
    ],
    resale:
      'Resale certificates are required (§ 34-36.1-4.09) covering assessments, reserves, insurance, and judgments.',
  },
  {
    slug: 'south-carolina',
    name: 'South Carolina',
    abbr: 'SC',
    condoAct: 'South Carolina Horizontal Property Act (S.C. Code § 27-31-10 et seq.)',
    hoaAct: 'South Carolina Homeowners Association Act (S.C. Code § 27-30-110 et seq.)',
    overview:
      'South Carolina condos operate under the Horizontal Property Act, and the 2018 HOA Act requires associations to record governing documents to enforce them and routes complaints through the Department of Consumer Affairs.',
    keyPoints: [
      'Governing documents must be recorded by January 10 each year to be enforceable',
      'DCA collects and publishes HOA complaint data',
      'Magistrate courts get expanded jurisdiction for HOA disputes',
    ],
    resale:
      'No statutory resale certificate; associations provide estoppel/account statements per documents.',
  },
  {
    slug: 'south-dakota',
    name: 'South Dakota',
    abbr: 'SD',
    condoAct: 'South Dakota condominium law (SDCL ch. 43-15A)',
    hoaAct: null,
    overview:
      'South Dakota’s condominium chapter is a horizontal-property-style framework; associations depend on declarations, bylaws, and nonprofit-corporation law for governance detail.',
    keyPoints: [
      'Statute covers creation, units, common elements, and assessments',
      'Documents control meetings, voting, and enforcement',
      'Nonprofit law provides default corporate rules',
    ],
    resale:
      'No statutory resale certificate; assessment statements are provided per governing documents.',
  },
  {
    slug: 'tennessee',
    name: 'Tennessee',
    abbr: 'TN',
    condoAct: 'Tennessee Condominium Act of 2008 (T.C.A. § 66-27-201 et seq.)',
    hoaAct: null,
    overview:
      'Tennessee condos created after 2009 fall under the Condominium Act of 2008 (UCA-based); older regimes remain under the Horizontal Property Act. HOAs are governed by covenants and nonprofit law.',
    keyPoints: [
      'UCA-style governance for post-2009 condominiums',
      'Statutory lien and foreclosure procedures for assessments',
      'Owner meeting and records rights under the 2008 act',
    ],
    resale:
      'Resale certificates are required for post-2009 condos (T.C.A. § 66-27-409) with assessments, reserves, and insurance.',
  },
  {
    slug: 'texas',
    name: 'Texas',
    abbr: 'TX',
    condoAct: 'Texas Uniform Condominium Act (Tex. Prop. Code ch. 82)',
    hoaAct: 'Texas Residential Property Owners Protection Act (Tex. Prop. Code ch. 209)',
    overview:
      'Texas governs post-1994 condos under the Uniform Condominium Act and subjects most single-family HOAs to chapter 209, a strong owner-protection statute: open board meetings, records production timelines, fining notice-and-cure, and judicial-foreclosure-style safeguards for assessment liens.',
    keyPoints: [
      'Ch. 209: fining requires written notice and a hearing opportunity; cure periods mandated',
      'Records requests must be answered on statutory timelines; management certificates filed with the county',
      'Expedited foreclosure of assessment liens requires court order for ch. 209 HOAs',
      'Open board meetings with posted notice (2021 SB 1588 expanded transparency)',
    ],
    resale:
      'Resale certificates are statutory for both condos (§ 82.157) and ch. 209 HOAs (§ 207.003), with content and fee rules.',
  },
  {
    slug: 'utah',
    name: 'Utah',
    abbr: 'UT',
    condoAct: 'Utah Condominium Ownership Act (Utah Code § 57-8)',
    hoaAct: 'Utah Community Association Act (Utah Code § 57-8a)',
    overview:
      'Utah maintains parallel condo and HOA statutes with a statewide HOA registry, reserve-analysis requirements, and detailed rulemaking/fining procedures added through steady legislative refinement.',
    keyPoints: [
      'Associations must register with the state HOA Registry to enforce liens',
      'Reserve analysis required at least every 6 years, reviewed every 3',
      'Rule changes require owner notice and comment procedures',
    ],
    resale:
      'Sellers/associations provide statutorily defined payoff and disclosure information; unregistered associations lose lien enforcement rights.',
  },
  {
    slug: 'vermont',
    name: 'Vermont',
    abbr: 'VT',
    condoAct: 'Vermont Common Interest Ownership Act (27A V.S.A.)',
    hoaAct: null,
    overview:
      'Vermont adopted UCIOA (Title 27A), covering condos and planned communities alike with uniform budget-ratification, records, meeting, and resale-certificate rules.',
    keyPoints: [
      'One UCIOA statute for all common-interest communities',
      'Owner budget ratification and open records',
      'Statutory warranties and public offering statements on new projects',
    ],
    resale:
      'Resale certificates are required (27A V.S.A. § 4-109) with assessments, reserves, insurance, and litigation.',
  },
  {
    slug: 'virginia',
    name: 'Virginia',
    abbr: 'VA',
    condoAct: 'Virginia Condominium Act (Va. Code § 55.1-1900 et seq.)',
    hoaAct: 'Virginia Property Owners’ Association Act (Va. Code § 55.1-1800 et seq.)',
    overview:
      'Virginia regulates condos and POAs under detailed twin acts supervised by the Common Interest Community Board, which registers associations and administers the CIC Ombudsman. The 2023 Resale Disclosure Act consolidated resale requirements for both regimes.',
    keyPoints: [
      'Annual registration with the Common Interest Community Board; Ombudsman complaint process',
      'Reserve study review required at least every 5 years',
      'Board meeting openness and owner comment periods are statutory',
      'Resale Disclosure Act (§ 55.1-2307 et seq.) unified condo/POA resale packages in 2023',
    ],
    resale:
      'Resale certificates follow the consolidated Resale Disclosure Act with defined contents, fees, and buyer cancellation rights.',
  },
  {
    slug: 'washington',
    name: 'Washington',
    abbr: 'WA',
    condoAct: 'Washington Uniform Common Interest Ownership Act — WUCIOA (RCW 64.90)',
    hoaAct: 'Older regimes: Condominium Act (RCW 64.34) and HOA Act (RCW 64.38)',
    overview:
      'Washington’s WUCIOA governs all common-interest communities created since July 2018 (older condos under RCW 64.34, older HOAs under RCW 64.38), with reserve studies, budget ratification, and strong records rights; several WUCIOA sections now reach older communities too.',
    keyPoints: [
      'Reserve studies required (updated annually, site visit every 3 years) unless exempt',
      'Budgets take effect only after owner ratification meeting',
      'Records production deadlines with per-day penalties for violations',
    ],
    resale:
      'Resale certificates are mandatory (RCW 64.90.640 for WUCIOA; 64.34.425 for older condos) with statutory fee caps.',
  },
  {
    slug: 'west-virginia',
    name: 'West Virginia',
    abbr: 'WV',
    condoAct: 'West Virginia Uniform Common Interest Ownership Act (W. Va. Code § 36B-1-101 et seq.)',
    hoaAct: null,
    overview:
      'West Virginia adopted UCIOA (chapter 36B) for communities created after 1986, giving condos and planned communities uniform budget, meeting, records, and resale rules.',
    keyPoints: [
      'UCIOA governance for post-1986 communities',
      'Statutory assessment liens with limited priority',
      'Owner meeting and records rights under 36B',
    ],
    resale:
      'Resale certificates are required (§ 36B-4-109) with assessments, reserves, and insurance details.',
  },
  {
    slug: 'wisconsin',
    name: 'Wisconsin',
    abbr: 'WI',
    condoAct: 'Wisconsin Condominium Ownership Act (Wis. Stat. ch. 703)',
    hoaAct: null,
    overview:
      'Wisconsin condominiums operate under chapter 703, which prescribes disclosure materials for new sales, executive-board duties, and owner rights; HOAs rely on covenants plus chapter 181 nonprofit law.',
    keyPoints: [
      'Disclosure materials required on developer sales with rescission rights',
      'Annual financial summaries to unit owners',
      'Statutory assessment lien procedures under ch. 703',
    ],
    resale:
      'Resales require delivery of the executive summary and disclosure documents under § 703.33, with buyer rescission windows.',
  },
  {
    slug: 'wyoming',
    name: 'Wyoming',
    abbr: 'WY',
    condoAct: 'Wyoming condominium statutes (Wyo. Stat. § 34-20-101 et seq.)',
    hoaAct: null,
    overview:
      'Wyoming’s condominium statutes are among the leanest in the country — creation, common elements, and taxation are addressed, and virtually all governance flows from recorded declarations and nonprofit-corporation law.',
    keyPoints: [
      'Statute establishes condominium form of ownership and assessment obligations',
      'Declarations and bylaws are the primary governance source',
      'Nonprofit law supplies default meeting and voting rules',
    ],
    resale:
      'No statutory resale certificate; associations provide account statements per documents.',
  },
  {
    slug: 'washington-dc',
    name: 'Washington, D.C.',
    abbr: 'DC',
    condoAct: 'D.C. Condominium Act (D.C. Code § 42-1901.01 et seq.)',
    hoaAct: null,
    overview:
      'The District’s Condominium Act pairs Virginia-style structure with active DHCD oversight of new condo registrations, and D.C. case law strongly protects owner rights in foreclosure and super-priority lien contexts.',
    keyPoints: [
      'New condominium offerings register with DHCD',
      'Six-month super-priority lien for assessments (with significant litigation history)',
      'Owner meeting, records, and notice rights under the act',
    ],
    resale:
      'Resale certificates are mandatory (§ 42-1904.11) with assessments, reserves, capital expenditures, and insurance.',
  },
]

export function getStateBySlug(slug: string): StateLaw | undefined {
  return STATE_LAWS.find((s) => s.slug === slug)
}
