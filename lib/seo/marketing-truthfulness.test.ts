import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8')
}

const home = source('app/(marketing)/page.tsx')
const demo = source('app/(marketing)/demo/page.tsx')
const comparisonPage = source('app/(marketing)/compare/[slug]/page.tsx')
const competitors = source('lib/seo/competitors.ts')
const marketingLayout = source('app/(marketing)/layout.tsx')
const sitemap = source('app/sitemap.ts')
const retiredStory = source('app/(marketing)/customers/stellar-property-management/page.tsx')

describe('public marketing truthfulness', () => {
  it('visibly identifies sample product figures', () => {
    expect(home.match(/Illustrative sample data/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
    expect(home).toContain('not customer counts or results')
    expect(home).toContain('do not represent customer activity or results')
  })

  it('does not make unverified adoption, capacity, or launch-speed claims', () => {
    const publicClaims = [home, demo, comparisonPage, competitors].join('\n')

    for (const unsupportedClaim of [
      /why management companies are switching/i,
      /most companies launch/i,
      /we onboard \d+ property management companies/i,
      /(?:inside|under|within) a week/i,
      /onboarding measured in days/i,
      /days to live/i,
      /42[- ]association/i,
      /2,450 doors/i,
    ]) {
      expect(publicClaims).not.toMatch(unsupportedClaim)
    }
  })

  it('retires unverified customer proof from every discovery surface', () => {
    expect(retiredStory).toContain("permanentRedirect('/company')")
    expect(retiredStory).not.toMatch(/Stellar Property Management|42 associations|2,450|blockquote|application\/ld\+json/i)

    for (const discoverySource of [marketingLayout, comparisonPage, sitemap]) {
      expect(discoverySource).not.toContain('/customers/stellar-property-management')
    }
  })

  it('advertises only the currently supported web application in structured data', () => {
    expect(marketingLayout).toContain("operatingSystem: 'Web'")
    expect(marketingLayout).not.toContain("operatingSystem: 'Web, iOS, Android'")
  })
})
