'use client'
import { useState } from 'react'
interface Props { code: string; name: string; size?: 'sm'|'md'|'lg'; className?: string }
const sizes = { sm:20, md:28, lg:40 }

// Maps FIFA 3-letter codes → ISO 3166-1 alpha-2 codes used by flagcdn.com.
// Mock data already uses 2-letter ISO codes (mx, pl, ar…) and passes through unchanged.
const FIFA_TO_ISO: Record<string, string> = {
  // British home nations (FIFA splits them, ISO doesn't)
  ENG:'gb-eng', SCO:'gb-sct', WAL:'gb-wls', NIR:'gb-nir',
  // Europe
  GER:'de', NED:'nl', CZE:'cz', SVK:'sk', CRO:'hr', SRB:'rs',
  SUI:'ch', DEN:'dk', SWE:'se', NOR:'no', FIN:'fi', ISL:'is',
  TUR:'tr', GRE:'gr', ROU:'ro', BUL:'bg', ALB:'al', SVN:'si',
  UKR:'ua', GEO:'ge', ARM:'am', AZE:'az', KAZ:'kz', HUN:'hu',
  MKD:'mk', MNE:'me', BIH:'ba', KOS:'xk', LUX:'lu',
  // CONCACAF
  MEX:'mx', USA:'us', CAN:'ca', CRC:'cr', PAN:'pa',
  HON:'hn', GTM:'gt', JAM:'jm', TRI:'tt', SLV:'sv', CUB:'cu',
  HAI:'ht', DOM:'do', GUY:'gy', SUR:'sr', BRB:'bb', ATG:'ag',
  // CONMEBOL
  ARG:'ar', BRA:'br', URU:'uy', COL:'co', ECU:'ec',
  CHI:'cl', PER:'pe', PAR:'py', BOL:'bo', VEN:'ve',
  // CAF (Africa)
  RSA:'za', MAR:'ma', SEN:'sn', GHA:'gh', NGR:'ng', NGA:'ng',
  CMR:'cm', CIV:'ci', TUN:'tn', EGY:'eg', ALG:'dz',
  MLI:'ml', BFA:'bf', GUI:'gn', GAM:'gm', COD:'cd', DRC:'cd',
  ZIM:'zw', ZAM:'zm', ANG:'ao', MOZ:'mz', GAB:'ga', GNB:'gw',
  BEN:'bj', TOG:'tg', LBR:'lr', KEN:'ke', UGA:'ug', TAN:'tz',
  ETH:'et', RWA:'rw', CPV:'cv', COM:'km', MDG:'mg', MRI:'mu',
  CTA:'cf', TCH:'td', NIG:'ne', SLE:'sl', GNE:'gq',
  // AFC (Asia)
  JPN:'jp', KOR:'kr', AUS:'au', CHN:'cn', IRN:'ir',
  KSA:'sa', QAT:'qa', UAE:'ae', JOR:'jo', IRQ:'iq',
  UZB:'uz', TJK:'tj', PHI:'ph', THA:'th', IDN:'id',
  MYS:'my', VIE:'vn', BHR:'bh', OMA:'om', KWT:'kw',
  SYR:'sy', LBN:'lb', IND:'in', PRK:'kp', ISR:'il',
  YEM:'ye', AFG:'af', PAK:'pk', BAN:'bd', NEP:'np',
  SGP:'sg', MYA:'mm', TLS:'tl', MNG:'mn', KGZ:'kg',
  // OFC (Oceania)
  NZL:'nz', FIJ:'fj', PNG:'pg', SOL:'sb', VAN:'vu', NCL:'nc',
}

export function FlagImg({ code, name, size='md', className }: Props) {
  const [err, setErr] = useState(false)
  const px = sizes[size]
  const isoCode = FIFA_TO_ISO[code.toUpperCase()] ?? code.toLowerCase()
  if (err) return (
    <span
      className="inline-flex items-center justify-center bg-gray-700 rounded text-xs font-bold text-gray-400"
      style={{width:px, height:px*0.67}}
    >
      {code.toUpperCase().slice(0,3)}
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
