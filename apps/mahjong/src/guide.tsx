import { useState } from 'react'
import { label } from './engine'
import { SPECIAL_TILE_ATLAS, SPECIAL_TILE_ATLAS_SIZE, specialTileRegion } from './specialTiles'

type RuleCard = { name: string; fan?: string; note: string; tiles: string[] }
type RulePage = { title: string; intro: string; cards: RuleCard[] }

const fourPages: RulePage[] = [
  { title: '四人港式麻雀', intro: '148 張牌：原有 144 張牌，加 4 張飛。番數與香港玩法沿用港雀現有規則。', cards: [
    { name: '牌組', note: '萬、筒、索、字牌、8 張花季，以及 4 張飛。花季摸到後會亮出並補牌。', tiles: ['m1','p1','s1','z1','z5','f1','j1','x1'] },
    { name: '起胡與封頂', note: '至少 3 番才可胡，13 番封頂。胡牌支付按四人港式牌局結算。', tiles: ['p2','p3','p4','z5','z5','z5'] },
    { name: '飛牌', note: '飛可在手牌中代替一張牌完成順子、刻子或將眼；可選用同牌或飛碰牌。飛不能作槓子，含飛的碰牌也不能加槓；不能吃碰別人打出的飛。飛不另加番。', tiles: ['x1','p2','p3','p4','z5','z5'] },
  ] },
  { title: '四人牌型例子', intro: '示意牌形會顯示在卡片內；番數以牌局結算顯示為準。', cards: [
    { name: '清一色', fan: '7 番', note: '只使用同一門數牌。', tiles: ['p1','p2','p3','p4','p5','p6','p7','p8','p9','p2','p3','p4','p5','p5'] },
    { name: '對對胡', fan: '3 番', note: '四組刻子或槓，加一對將。', tiles: ['p2','p2','p2','s4','s4','s4','z5','z5','z5','z1','z1','z1','p9','p9'] },
    { name: '混一色', fan: '3 番', note: '一門數牌加字牌。', tiles: ['p1','p2','p3','p4','p5','p6','p7','p8','p9','z5','z5','z5','z1','z1'] },
  ] },
  { title: '四人媽幣結算', intro: '媽幣是帳號內累積的虛擬餘額；新帳號有 500 枚。', cards: [
    { name: '放銃', note: '放銃者支付贏家的最終番數；其他玩家不付。', tiles: ['p4','p5','p6'] },
    { name: '自摸', note: '其餘每位玩家各支付贏家的最終番數。', tiles: ['s2','s3','s4'] },
    { name: '真人對局', note: '線上房只在真人帳號之間轉移媽幣；電腦玩家不會增加或扣除帳號餘額。', tiles: ['z1','z2','z3','x1'] },
  ] },
]

const threePages: RulePage[] = [
  { title: '馬來西亞三人麻雀', intro: '84 張牌：36 張筒子、28 張字牌、8 張花季、4 張動物、4 張人頭、4 張飛。座風為東、南、北。', cards: [
    { name: '筒子與字牌', note: '只使用一至九筒與東南西北中發白；沒有萬子、索子。', tiles: ['p1','p2','p3','p4','p5','p6','p7','p8','p9','z1','z5'] },
    { name: '花、季、動物、人頭', note: '摸到後亮出並補牌。個別牌、完整四張組合、門風花季會計入番數。', tiles: ['f1','f2','f3','f4','j1','j2','a1','h1'] },
    { name: '動物、人頭與飛', note: '動物依次是貓、鼠、雞、蜈蚣；四張人頭使用同一個人物圖案；飛是紅字牌。', tiles: ['a1','a2','a3','a4','h1','h2','h3','h4','x1'] },
    { name: '起胡與爆番', fan: '5 番起胡', note: '至少 5 番才可胡；原始番數達 10 番即爆番，按 10 × 2＝20 的結算值付款。沒有二爆或三爆。飛本身不加番。', tiles: ['p2','p3','p4','z5','z5','z5','x1'] },
  ] },
  { title: '三人番型例子', intro: '牌型番數可相加；原始番數達 10 番便以爆番 ×2 結算。', cards: [
    { name: '清一色', fan: '3 番', note: '全手只有筒子。', tiles: ['p1','p2','p3','p4','p5','p6','p7','p8','p9','p2','p3','p4','p5','p5'] },
    { name: '混一色', fan: '1 番', note: '筒子加字牌。', tiles: ['p1','p2','p3','p4','p5','p6','z5','z5','z5','z1','z1','z1','p9','p9'] },
    { name: '對對胡／小三元', fan: '各 2／3 番', note: '對對胡是四組刻子或槓加一對；小三元是兩組三元牌刻子加第三種作將。', tiles: ['z5','z5','z5','z6','z6','z6','z7','z7','p2','p2','p2','z1','z1','z1'] },
  ] },
  { title: '飛牌與媽幣', intro: '本桌採用基本飛牌規則；線上房媽幣只在仍在線的真人之間轉移。無網局只記本局分數。', cards: [
    { name: '飛作百搭', note: '可代一張牌完成順子、刻子或將眼。碰牌時可選兩張同牌，或一張同牌加飛；吃牌可用飛補順子。含飛的碰牌不能加槓，棄出的飛不能被取用。', tiles: ['x1','p4','p5','p6','z5','z5'] },
    { name: '胡牌付款', note: '三人放銃：放銃者付雙份，另一位付單份。自摸：兩位對手各付雙份。每份等於最終番數。', tiles: ['p2','p3','p4'] },
    { name: '媽幣範例', note: '6 番放銃：放銃者付 12，另一位付 6，胡牌者收 18。6 番自摸：兩位對手各付 12，胡牌者收 24。', tiles: ['p6','p6','p6','x1'] },
    { name: '爆番範例', note: '10 番或以上統一按結算值 20：放銃者付 40，另一位付 20，胡牌者收 60；自摸時兩位對手各付 40，胡牌者收 80。', tiles: ['p9','p9','p9','z5','z5','z5','x1'] },
  ] },
]

function TileRow({ codes }: { codes: string[] }) {
  return <div className="guide-tiles" aria-label={codes.map(label).join('、')}>
    {codes.map((code, index) => {
      const region = specialTileRegion(code)
      return region
        ? <svg key={`${code}-${index}`} viewBox={`${region.x} ${region.y} ${region.width} ${region.height}`} role="img" aria-label={label(code)}><image href={SPECIAL_TILE_ATLAS} width={SPECIAL_TILE_ATLAS_SIZE.width} height={SPECIAL_TILE_ATLAS_SIZE.height} /></svg>
        : <img key={`${code}-${index}`} src={`/mahjong/assets/tiles/${code}.svg`} alt={label(code)} />
    })}
  </div>
}

export function Guide({ onClose }: { onClose: () => void }) {
  const [variant, setVariant] = useState<'three' | 'four'>('four')
  const [page, setPage] = useState(0)
  const pages = variant === 'three' ? threePages : fourPages
  const current = pages[page]
  const changeVariant = (next: 'three' | 'four') => { setVariant(next); setPage(0) }
  return <div className="modal-shade"><section className="guide-panel" role="dialog" aria-modal="true" aria-label="港雀玩法說明">
    <button className="close" onClick={onClose} aria-label="關閉說明">×</button>
    <nav className="guide-variant" aria-label="选择麻将玩法"><button className={variant === 'three' ? 'selected' : ''} onClick={() => changeVariant('three')}>三人麻雀</button><button className={variant === 'four' ? 'selected' : ''} onClick={() => changeVariant('four')}>四人麻雀</button></nav>
    <div className="guide-heading"><small>玩法說明 · {page + 1} / {pages.length}</small><h2>{current.title}</h2><p>{current.intro}</p><small>特殊牌面參考 <a href="https://commons.wikimedia.org/wiki/File:Mala_tiles.png" target="_blank" rel="noreferrer">Cangjie6《Mala tiles》</a> · CC BY-SA 4.0，已重新排版與清理</small></div>
    <div className="guide-cards">{current.cards.map(card => <article className="guide-card" key={card.name}>
      <div className="guide-card-title"><strong>{card.name}</strong>{card.fan && <b>{card.fan}</b>}</div>
      <TileRow codes={card.tiles} /><p>{card.note}</p>
    </article>)}</div>
    <div className="guide-pagination"><button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>上一頁</button><span>{pages.map((_, index) => <button key={index} className={index === page ? 'selected' : ''} aria-label={`第 ${index + 1} 頁`} aria-current={index === page ? 'page' : undefined} onClick={() => setPage(index)} />)}</span><button onClick={page === pages.length - 1 ? onClose : () => setPage(page + 1)}>{page === pages.length - 1 ? '返回牌局' : '下一頁'}</button></div>
  </section></div>
}
