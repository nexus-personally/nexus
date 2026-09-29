import { useState } from 'react'
import { FAN_CAP, MIN_FAN, label } from './engine'

type RuleCard = { name: string; fan?: string; note: string; tiles: string[] }
type RulePage = { title: string; intro: string; cards: RuleCard[] }

const pages: RulePage[] = [
  { title: '開局與操作', intro: '選牌後按「出牌」；可吃、碰、槓、胡時，對應按鈕會發光。', cards: [
    { name: '四人局', note: '144 張，包含 8 張花季牌；摸到花季牌會補牌。', tiles: ['m1', 'm2', 'm3', 'p1', 'p2', 'p3', 's1', 's2', 's3', 'z1', 'z5', 'f1'] },
    { name: '三人局', note: '116 張，移除二至八萬；保留花季牌，也可以吃牌。', tiles: ['m1', 'm9', 'p1', 'p2', 'p3', 's1', 's2', 's3', 'z1', 'z5', 'f1'] },
    { name: '應牌順序', note: '胡優先於碰、槓；碰、槓優先於吃。只許一人胡牌，同級按座位順序。', tiles: ['p3', 'p3', 'p3', 's2', 's3', 's4'] },
  ] },
  { title: '起胡與基本番', intro: `本遊戲預設滿 ${MIN_FAN} 番才可胡；番數可相加，${FAN_CAP} 番起算爆番並封頂。`, cards: [
    { name: '自摸', fan: '1 番', note: '自己摸到胡牌張。門前清自摸再加 1 番。', tiles: ['p2', 'p3', 'p4', 'p5'] },
    { name: '無花／正花／正季', fan: '各 1 番', note: '胡牌時沒有花季牌得無花；與門風相符的花、與圈風相符的季各加 1 番。', tiles: ['f1', 'j1', 'f2', 'j2'] },
    { name: '三元牌', fan: '各 1 番', note: '紅中、發財、白板每組刻子各加 1 番。', tiles: ['z5', 'z5', 'z5', 'z6', 'z6', 'z6'] },
    { name: '門風／圈風', fan: '各 1 番', note: '對應風牌刻子各加 1 番；同一刻子可同時符合門風與圈風。', tiles: ['z1', 'z1', 'z1', 'z2', 'z2', 'z2'] },
  ] },
  { title: '常見牌型', intro: '牌面是示意；正式胡牌仍須符合四組面子加一對將牌。', cards: [
    { name: '對對胡', fan: '3 番', note: '四組刻子或槓，加一對將牌。', tiles: ['p2', 'p2', 'p2', 's4', 's4', 's4', 'z5', 'z5', 'z5', 'z1', 'z1', 'z1', 'p9', 'p9'] },
    { name: '混一色', fan: '3 番', note: '一種數牌加字牌。', tiles: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'z5', 'z5', 'z5', 'z1', 'z1'] },
    { name: '清一色', fan: '7 番', note: '只用同一種數牌，沒有字牌。', tiles: ['s1', 's2', 's3', 's2', 's3', 's4', 's5', 's6', 's7', 's7', 's8', 's9', 's9', 's9'] },
    { name: '小三元', fan: '5 番', note: '兩組三元牌刻子，另一種三元牌作將。', tiles: ['z5', 'z5', 'z5', 'z6', 'z6', 'z6', 'z7', 'z7', 'p1', 'p2', 'p3', 's4', 's5', 's6'] },
  ] },
  { title: '爆番牌型', intro: `下列牌型各為 ${FAN_CAP} 番；多個番型合計超過 ${FAN_CAP} 番仍按 ${FAN_CAP} 番結算。`, cards: [
    { name: '十三么', fan: '13 番', note: '十三種么九字牌各一張，其中一種再成對。', tiles: ['m1', 'm9', 'p1', 'p9', 's1', 's9', 'z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7', 'z1'] },
    { name: '大三元／大四喜', fan: '13 番', note: '三種三元牌全成刻子，或四種風牌全成刻子。', tiles: ['z5', 'z5', 'z5', 'z6', 'z6', 'z6', 'z7', 'z7', 'z7'] },
    { name: '小四喜／字一色', fan: '13 番', note: '三組風刻子加一對風將，或全手都是字牌。', tiles: ['z1', 'z1', 'z1', 'z2', 'z2', 'z2', 'z3', 'z3', 'z3', 'z4', 'z4'] },
    { name: '清么九／四槓', fan: '13 番', note: '全手只用數牌一、九，或完成四組槓。', tiles: ['m1', 'm1', 'm1', 'p9', 'p9', 'p9', 's1', 's1', 's1'] },
  ] },
  { title: '結算與連莊', intro: '這些番值是港雀專用預設，可在日後的規則設定中調整，不代表所有香港麻雀玩法。', cards: [
    { name: '出銃', note: '放銃者支付贏家的封頂番數；一張棄牌只會有一位贏家。', tiles: ['p7', 'p7', 'p7'] },
    { name: '自摸', note: '另外每位玩家各支付一次封頂番數。', tiles: ['s3', 's3', 's3'] },
    { name: '莊家與流局', note: '莊家胡或流局保留莊位；閒家胡則莊位輪轉。東南圈結束後完場。', tiles: ['z1', 'z2', 'z3', 'z4'] },
    { name: '目前番數', note: '桌上只顯示你自己的牌型參考番數；摸牌、出牌可能改變它。胡牌時才核對完整牌型與最終番數。', tiles: ['m1', 'm2', 'm3', 'z5', 'z5', 'z5'] },
  ] },
]

function TileRow({ codes }: { codes: string[] }) {
  return <div className="guide-tiles" aria-label={codes.map(label).join('、')}>
    {codes.map((code, index) => <img key={`${code}-${index}`} src={`/mahjong/assets/tiles/${code}.svg`} alt={label(code)} />)}
  </div>
}

export function Guide({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState(0)
  const current = pages[page]
  return <div className="modal-shade"><section className="guide-panel" role="dialog" aria-modal="true" aria-label="港雀玩法說明">
    <button className="close" onClick={onClose} aria-label="關閉說明">×</button>
    <div className="guide-heading"><small>玩法說明 · {page + 1} / {pages.length}</small><h2>{current.title}</h2><p>{current.intro}</p></div>
    <div className="guide-cards">{current.cards.map(card => <article className="guide-card" key={card.name}>
      <div className="guide-card-title"><strong>{card.name}</strong>{card.fan && <b>{card.fan}</b>}</div>
      <TileRow codes={card.tiles} /><p>{card.note}</p>
    </article>)}</div>
    <div className="guide-pagination"><button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>上一頁</button><span>{pages.map((_, index) => <button key={index} className={index === page ? 'selected' : ''} aria-label={`第 ${index + 1} 頁`} aria-current={index === page ? 'page' : undefined} onClick={() => setPage(index)} />)}</span><button onClick={page === pages.length - 1 ? onClose : () => setPage(page + 1)}>{page === pages.length - 1 ? '返回牌局' : '下一頁'}</button></div>
  </section></div>
}
