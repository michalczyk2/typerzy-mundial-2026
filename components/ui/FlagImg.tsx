'use client'
import { useState } from 'react'
interface Props { code: string; name: string; size?: 'sm'|'md'|'lg'|'xl'; className?: string }
const sizes = { sm:20, md:28, lg:40, xl:52 }

// Maps FIFA 3-letter codes → ISO 3166-1 alpha-2 codes required by flagcdn.com.
//
// Source of truth: rezarahiminia/worldcup2026 football.teams.json (iso2 field).
// Mock data already uses 2-letter ISO codes (mx, pl, ar…) — they pass through
// the `?? upper.toLowerCase()` fallback unchanged.
//
// Two extra fallback entries handle openfootball name-mismatch cases where
// football-provider falls back to name.slice(0,3).toUpperCase():
//   "Bosnia & Herzegovina" ≠ Reza "Bosnia and Herzegovina" → BOS
//   "DR Congo"             ≠ Reza "Democratic Republic…"   → DR  (trimmed: DR)
const FIFA_TO_ISO: Record<string, string> = {
  // ── British home nations ──────────────────────────────────────────────────
  ENG:'gb-eng', SCO:'gb-sct', WAL:'gb-wls', NIR:'gb-nir',
  // ── Europe ───────────────────────────────────────────────────────────────
  AUT:'at',  BEL:'be',  BIH:'ba',  BUL:'bg',  CRO:'hr',  CZE:'cz',
  DEN:'dk',  FIN:'fi',  FRA:'fr',  GER:'de',  GRE:'gr',  HUN:'hu',
  ISL:'is',  ITA:'it',  KAZ:'kz',  KOS:'xk',  LUX:'lu',  MKD:'mk',
  MNE:'me',  NED:'nl',  NOR:'no',  POL:'pl',  POR:'pt',  ROU:'ro',
  RUS:'ru',  SRB:'rs',  SUI:'ch',  SVK:'sk',  SVN:'si',  SWE:'se',
  TUR:'tr',  UKR:'ua',  GEO:'ge',  ARM:'am',  AZE:'az',  ALB:'al',
  // ── CONCACAF ─────────────────────────────────────────────────────────────
  CAN:'ca',  CRC:'cr',  CUB:'cu',  CUW:'cw',  DOM:'do',  GTM:'gt',
  GUY:'gy',  HAI:'ht',  HON:'hn',  JAM:'jm',  MEX:'mx',  PAN:'pa',
  SLV:'sv',  SUR:'sr',  TRI:'tt',  USA:'us',  BRB:'bb',  ATG:'ag',
  // ── CONMEBOL ─────────────────────────────────────────────────────────────
  ARG:'ar',  BOL:'bo',  BRA:'br',  CHI:'cl',  COL:'co',  ECU:'ec',
  PAR:'py',  PER:'pe',  URU:'uy',  VEN:'ve',
  // ── Africa (CAF) ─────────────────────────────────────────────────────────
  ALG:'dz',  ANG:'ao',  BEN:'bj',  BFA:'bf',  CMR:'cm',  CIV:'ci',
  COD:'cd',  CPV:'cv',  DRC:'cd',  EGY:'eg',  ETH:'et',  GAB:'ga',
  GAM:'gm',  GHA:'gh',  GNB:'gw',  GUI:'gn',  GNE:'gq',  KEN:'ke',
  LBR:'lr',  MAR:'ma',  MDG:'mg',  MLI:'ml',  MOZ:'mz',  MRI:'mu',
  NGA:'ng',  NGR:'ng',  NIG:'ne',  RSA:'za',  RWA:'rw',  SEN:'sn',
  SLE:'sl',  CTA:'cf',  TCH:'td',  TOG:'tg',  TAN:'tz',  TUN:'tn',
  UGA:'ug',  ZAM:'zm',  ZIM:'zw',  COM:'km',
  // ── Asia (AFC) ───────────────────────────────────────────────────────────
  AFG:'af',  AUS:'au',  BAN:'bd',  BHR:'bh',  CHN:'cn',  IDN:'id',
  IND:'in',  IRN:'ir',  IRQ:'iq',  ISR:'il',  JOR:'jo',  JPN:'jp',
  KOR:'kr',  KSA:'sa',  KGZ:'kg',  KWT:'kw',  LBN:'lb',  MNG:'mn',
  MYA:'mm',  MYS:'my',  NEP:'np',  OMA:'om',  PAK:'pk',  PHI:'ph',
  PRK:'kp',  QAT:'qa',  SGP:'sg',  SRI:'lk',  SYR:'sy',  THA:'th',
  TJK:'tj',  TLS:'tl',  UAE:'ae',  UZB:'uz',  VIE:'vn',  YEM:'ye',
  // ── Oceania (OFC) ────────────────────────────────────────────────────────
  FIJ:'fj',  NCL:'nc',  NZL:'nz',  PNG:'pg',  SOL:'sb',  VAN:'vu',
  // ── Spain & Portugal (common omissions) ──────────────────────────────────
  ESP:'es',
  // ── OFB name-mismatch fallbacks ──────────────────────────────────────────
  // "Bosnia & Herzegovina" (OFB) ≠ "Bosnia and Herzegovina" (Reza) → slice → BOS
  BOS:'ba',
  // "DR Congo" (OFB) → slice(0,3) = "DR " → after trim → "DR"
  DR: 'cd',
}

export function FlagImg({ code, name, size='md', className }: Props) {
  const [err, setErr] = useState(false)
  const px = sizes[size]
  // Trim handles "DR " (DR Congo OFB fallback has a trailing space)
  const upper = code.trim().toUpperCase()
  const isoCode = FIFA_TO_ISO[upper] ?? upper.toLowerCase()

  if (process.env.NODE_ENV === 'development' && !FIFA_TO_ISO[upper] && upper.length > 2) {
    console.warn(`[FlagImg] no ISO mapping for code "${code}" (${name}) — using "${isoCode}"`)
  }

  if (err) return (
    <span
      className="inline-flex items-center justify-center bg-gray-700 rounded text-xs font-bold text-gray-400"
      style={{width:px, height:px*0.67}}
    >
      {upper.slice(0,3)}
    </span>
  )
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w40/${isoCode}.png`}
      alt={name}
      width={px}
      height={Math.round(px*0.67)}
      className={`rounded-sm object-cover ${className||''}`}
      onError={() => setErr(true)}
    />
  )
}
