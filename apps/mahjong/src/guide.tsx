import { useEffect, useRef, useState } from 'react'
import { label } from './engine'
import { SPECIAL_TILE_ATLAS, SPECIAL_TILE_ATLAS_SIZE, specialTileRegion } from './specialTiles'

type RuleCard = { name: string; fan?: string; note: string; tiles: string[] }
type RulePage = { title: string; intro: string; cards: RuleCard[] }

const fourPages: RulePage[] = [
  { title: '四人港式麻雀', intro: '152 張牌：136 張基本牌、8 張花季、4 張動物及 4 張飛；四面牌牆各 19 棟。', cards: [
    { name: '牌組', note: '萬、筒、索、字牌、花季、動物及飛。花季與動物摸到後會亮出並補牌。', tiles: ['m1','p1','s1','z1','z5','f1','j1','a1','x1'] },
    { name: '起胡與爆番', note: '至少 3 番才可胡。原始番數少於 10 按原數結算；達 10 番後只爆一次，按原始總番 ×2 結算，不設封頂。', tiles: ['p2','p3','p4','z5','z5','z5'] },
    { name: '飛牌', note: '飛必须留在手牌中，不能当作不要的牌打出。它可代替一張牌完成順子、刻子或將眼，并可選用同牌或飛碰牌。飛不能作槓子，含飛的碰牌也不能加槓。飛不另加番。', tiles: ['x1','p2','p3','p4','z5','z5'] },
  ] },
  { title: '四人牌型例子', intro: '示意牌形會顯示在卡片內；番數以牌局結算顯示為準。', cards: [
    { name: '清一色', fan: '7 番', note: '只使用同一門數牌。', tiles: ['p1','p2','p3','p4','p5','p6','p7','p8','p9','p2','p3','p4','p5','p5'] },
    { name: '對對胡', fan: '3 番', note: '四組刻子或槓，加一對將。', tiles: ['p2','p2','p2','s4','s4','s4','z5','z5','z5','z1','z1','z1','p9','p9'] },
    { name: '混一色', fan: '3 番', note: '一門數牌加字牌。', tiles: ['p1','p2','p3','p4','p5','p6','p7','p8','p9','z5','z5','z5','z1','z1'] },
  ] },
  { title: '四人媽幣結算', intro: '媽幣是帳號內累積的虛擬餘額；新帳號有 500 枚。', cards: [
    { name: '放銃', note: '放銃者支付最終番數的雙倍，其餘兩位玩家各支付一倍。', tiles: ['p4','p5','p6'] },
    { name: '自摸', note: '其餘三位玩家各支付最終番數的雙倍。', tiles: ['s2','s3','s4'] },
    { name: '真人對局', note: '線上房只在真人帳號之間轉移媽幣；電腦玩家不會增加或扣除帳號餘額。', tiles: ['z1','z2','z3','x1'] },
  ] },
  { title: '出牌與應牌', intro: '摸牌後打出一張牌；吃、碰、槓、胡會依固定優先順序處理。', cards: [
    { name: '吃牌', note: '只有出牌者的下一家可以吃；有多個合法順子時要選擇實際組合。', tiles: ['m3','m4','m5'] },
    { name: '應牌優先', note: '多人同時應牌時依胡、槓、碰、吃排序；同級由出牌者之後最近的座位優先。', tiles: ['z5','z5','z5'] },
    { name: '飛牌組合', note: '碰牌可用兩張同牌、同牌加飛，或兩張飛代替；飛不能組成槓。', tiles: ['z5','x1','x1'] },
  ] },
  { title: '四人完整番表（一）', intro: '番型可以相加；牌局至少三番才可胡。', cards: [
    { name: '自摸／門前清／平胡', fan: '各 1 番', note: '自摸、没有吃碰明槓的門前清，以及基本全順子牌型各一番；暗槓不破門清。', tiles: ['p2','p3','p4'] },
    { name: '無花', fan: '10 番', note: '胡牌時没有花、季或動物即成立；飛不會破壞無花。十番會觸發爆番，結算為 20。', tiles: ['x1','p2','p3','p4'] },
    { name: '正花／正季／動物', fan: '每張 1 番', note: '與座風相符的花、季各一番；每張動物各一番。同組四張集齊另加兩番。', tiles: ['f1','j1','a1','a2','a3','a4'] },
    { name: '混一色／清一色', fan: '3／7 番', note: '一門數牌加字牌為混一色；只用一門數牌為清一色。', tiles: ['p1','p2','p3','z5','z5','z5'] },
    { name: '對對胡', fan: '3 番', note: '四組刻子或槓，加一對將。', tiles: ['p2','p2','p2','z5','z5','z5'] },
  ] },
  { title: '四人完整番表（二）', intro: '所有成立番型相加成为原始番数；十番或以上统一爆番 ×2。', cards: [
    { name: '三元牌', fan: '刻 1／小三元 5／大三元 8', note: '中、發、白刻各一番；兩刻一對為小三元；三刻為大三元。', tiles: ['z5','z6','z7'] },
    { name: '風牌', fan: '門風／圈風各 1', note: '自己的座風刻及目前圈風刻分别加一番；小四喜 8 番，大四喜 10 番。', tiles: ['z1','z2','z3','z4'] },
    { name: '槓子', fan: '明槓 1／暗槓 2', note: '每組槓逐組計番，仍可同時計入三元牌、門風或圈風；飛不可成槓，含飛的碰也不可加槓。', tiles: ['z5','z5','z5','z5'] },
    { name: '其他番型', fan: '缺一門 2／字一色 10', note: '缺少萬、筒、索其中一門為缺一門；全副字牌為字一色。海底、搶槓胡及槓上開花各一番。', tiles: ['m1','p1','z1','z5'] },
  ] },
  { title: '莊家與牌局流程', intro: '牌局進行東圈及南圈；莊家結果決定是否連莊。', cards: [
    { name: '連莊', note: '莊家胡牌，或流局時莊家聽牌，莊家繼續坐莊並增加連莊數。', tiles: ['z1','z1','z1'] },
    { name: '換莊', note: '非莊家胡牌，或流局時莊家未聽牌，下一席接莊。完成南圈後整場結束。', tiles: ['z2','z2','z2'] },
    { name: '超時', note: '朋友房出牌限時十五秒；超時直接打出系統建議牌。應牌超時自動選擇過。', tiles: ['p4','p5','p6'] },
  ] },
]

const threePages: RulePage[] = [
  { title: '馬來西亞三人麻雀', intro: '84 張牌：36 張筒子、28 張字牌、8 張花季、4 張動物、4 張人頭、4 張飛。座風為東、南、北。', cards: [
    { name: '筒子與字牌', note: '只使用一至九筒與東南西北中發白；沒有萬子、索子。', tiles: ['p1','p2','p3','p4','p5','p6','p7','p8','p9','z1','z5'] },
    { name: '花、季、動物、人頭', note: '摸到後亮出並補牌。個別牌、完整四張組合、門風花季會計入番數。', tiles: ['f1','f2','f3','f4','j1','j2','a1','h1'] },
    { name: '動物、人頭與飛', note: '動物依次是貓、鼠、雞、蜈蚣；四張人頭使用同一個人物圖案；飛是紅字牌。', tiles: ['a1','a2','a3','a4','h1','h2','h3','h4','x1'] },
    { name: '起胡與爆番', fan: '5 番起胡', note: '至少 5 番才可胡；原始番數達 10 番即爆番，將原始番數直接乘 2。例：39 番 ×2＝78。沒有二爆或三爆。飛本身不加番。', tiles: ['p2','p3','p4','z5','z5','z5','x1'] },
  ] },
  { title: '三人番型例子', intro: '牌型番數可相加；原始番數達 10 番便将原始总番数 ×2 結算。', cards: [
    { name: '清一色', fan: '3 番', note: '全手只有筒子。', tiles: ['p1','p2','p3','p4','p5','p6','p7','p8','p9','p2','p3','p4','p5','p5'] },
    { name: '混一色', fan: '1 番', note: '筒子加字牌。', tiles: ['p1','p2','p3','p4','p5','p6','z5','z5','z5','z1','z1','z1','p9','p9'] },
    { name: '對對胡／小三元', fan: '各 2／3 番', note: '對對胡是四組刻子或槓加一對；小三元是兩組三元牌刻子加第三種作將。', tiles: ['z5','z5','z5','z6','z6','z6','z7','z7','p2','p2','p2','z1','z1','z1'] },
  ] },
  { title: '飛牌與媽幣', intro: '本桌採用基本飛牌規則；線上房以本局開局時的真人帳號結算，主動離開也不能逃避輸贏。無網局只記本局分數。', cards: [
    { name: '飛作百搭', note: '飛必须留在手牌中，不能打到牌河。它可代一張牌完成順子、刻子或將眼。碰牌時可選兩張同牌，或一張同牌加飛；吃牌可用飛補順子。含飛的碰牌不能加槓。', tiles: ['x1','p4','p5','p6','z5','z5'] },
    { name: '胡牌付款', note: '三人放銃：放銃者付雙份，另一位付單份。自摸：兩位對手各付雙份。每份等於最終番數。', tiles: ['p2','p3','p4'] },
    { name: '媽幣範例', note: '6 番放銃：放銃者付 12，另一位付 6，胡牌者收 18。6 番自摸：兩位對手各付 12，胡牌者收 24。', tiles: ['p6','p6','p6','x1'] },
    { name: '爆番範例', note: '原始 39 番时，爆番结算值是 39 ×2＝78。放銃者付 156，另一位付 78，胡牌者收 234；自摸時兩位對手各付 156，胡牌者收 312。', tiles: ['p9','p9','p9','z5','z5','z5','x1'] },
  ] },
  { title: '出牌與應牌', intro: '三人局同樣按固定優先次序處理應牌。', cards: [
    { name: '吃牌', note: '只有出牌者的下一家可以吃；飛可以補足順子。', tiles: ['p3','p4','x1'] },
    { name: '碰與飛', note: '可用兩張同牌、同牌加飛，或兩張飛代替別人打出的牌完成碰；飛不能組成槓。', tiles: ['z5','x1','x1'] },
    { name: '應牌優先', note: '依胡、實牌槓、實牌碰、飛碰、吃排序；同級由出牌者之後最近的座位優先。', tiles: ['z5','z5','z5'] },
  ] },
  { title: '三人完整番表（一）', intro: '下列為一般及花牌相關番數；番型可以相加。', cards: [
    { name: '無花', fan: '10 番', note: '胡牌時沒有任何花、季、動物或人頭。', tiles: ['p2','p3','p4'] },
    { name: '花季', fan: '每張 1 番', note: '與座風相符的花季，以及編號四的花季，均各加一番；同組四張齊集再加一番。', tiles: ['f1','f4','j1','j4'] },
    { name: '動物與人頭', fan: '每張 1 番', note: '貓、鼠、雞、蜈蚣及每張人頭各一番；同組四張齊集再加一番。', tiles: ['a1','a2','a3','a4','h1'] },
    { name: '補牌／搶槓', fan: '各 1 番', note: '補花後立即自摸、槓後補牌立即自摸、搶槓胡各加一番。', tiles: ['f1','p5','p5'] },
  ] },
  { title: '三人完整番表（二）', intro: '一般牌型與字牌番型。', cards: [
    { name: '平胡（筒眼）／七對', fan: '各 1 番', note: '全順子並以筒子作將為平胡；七組對子為七對。', tiles: ['p2','p3','p4','p5','p5'] },
    { name: '對對胡／混一色／清一色', fan: '2／1／3 番', note: '全部刻子為對對胡；筒子加字牌為混一色；只有筒子為清一色。', tiles: ['p2','p2','p2','z5','z5','z5'] },
    { name: '三元牌', fan: '刻 1／小三元 3／大三元 10', note: '中、發、白依組合計番。', tiles: ['z5','z6','z7'] },
    { name: '風牌', fan: '刻 1 或 10 番', note: '東風、北風及門風刻按條件加番；三風刻與風牌大牌為十番。', tiles: ['z1','z2','z4'] },
  ] },
  { title: '三人十番牌型', intro: '原始番達十番便爆番，最終結算值為原始番數乘二。', cards: [
    { name: '牌型', fan: '10 番', note: '字一色、四槓、九蓮寶燈、四暗刻及海底／河底。九蓮寶燈與四暗刻必須自摸。', tiles: ['p1','p1','p1','p9','p9','p9'] },
    { name: '特殊牌', fan: '10 番', note: '十六花，以及連續兩次槓後補牌自摸。', tiles: ['f1','f2','f3','f4'] },
    { name: '爆番', note: '把所有原始番相加；達十番後將原始總番乘二，不設二爆或三爆。', tiles: ['p9','p9','p9','z5','z5','z5'] },
  ] },
  { title: '莊家與牌局流程', intro: '三人座風依次為東、南、北，牌局完成東圈及南圈。', cards: [
    { name: '連莊與換莊', note: '莊家胡牌或流局聽牌便連莊；否則下一席接莊。', tiles: ['z1','z2','z4'] },
    { name: '超時', note: '朋友房出牌限時十五秒；超時直接打建議牌。應牌超時不吃、不碰、不槓、不胡，直接過。', tiles: ['p4','p5','p6'] },
    { name: '離開房間', note: '玩家離開後由電腦接管，本局仍照常結算；無網房主離開會結束未完成牌局。', tiles: ['x1','z1'] },
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
  const cards = useRef<HTMLDivElement>(null)
  const touch = useRef<{ x: number; y: number; blocked: boolean } | null>(null)
  const pages = variant === 'three' ? threePages : fourPages
  const current = pages[page]
  const changeVariant = (next: 'three' | 'four') => { setVariant(next); setPage(0) }
  const changePage = (next: number) => setPage(Math.max(0, Math.min(pages.length - 1, next)))
  useEffect(() => { cards.current?.scrollTo({ top: 0 }); cards.current?.focus({ preventScroll: true }) }, [page, variant])
  return <div className="modal-shade"><section className="guide-panel" role="dialog" aria-modal="true" aria-label="港雀玩法說明" onTouchStart={event => { const target = event.target as HTMLElement; const point = event.touches[0]; touch.current = { x: point.clientX, y: point.clientY, blocked: Boolean(target.closest('.guide-tiles')) } }} onTouchEnd={event => { const start = touch.current; touch.current = null; if (!start || start.blocked) return; const point = event.changedTouches[0]; const dx = point.clientX - start.x, dy = point.clientY - start.y; if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) changePage(page + (dx < 0 ? 1 : -1)) }}>
    <button className="close" onClick={onClose} aria-label="關閉說明">×</button>
    <nav className="guide-variant" aria-label="选择麻将玩法"><button className={variant === 'three' ? 'selected' : ''} onClick={() => changeVariant('three')}>三人麻雀</button><button className={variant === 'four' ? 'selected' : ''} onClick={() => changeVariant('four')}>四人麻雀</button></nav>
    <div className="guide-heading" aria-live="polite"><small>玩法說明 · {page + 1} / {pages.length}</small><h2>{current.title}</h2><p>{current.intro}</p></div>
    <div className="guide-cards" ref={cards} tabIndex={-1}>{current.cards.map(card => <article className="guide-card" key={card.name}>
      <div className="guide-card-title"><strong>{card.name}</strong>{card.fan && <b>{card.fan}</b>}</div>
      <TileRow codes={card.tiles} /><p>{card.note}</p>
    </article>)}</div>
    <div className="guide-pagination"><button onClick={() => changePage(page - 1)} disabled={page === 0}>上一頁</button><span>{pages.map((_, index) => <button key={index} className={index === page ? 'selected' : ''} aria-label={`第 ${index + 1} 頁`} aria-current={index === page ? 'page' : undefined} onClick={() => changePage(index)} />)}</span><button onClick={page === pages.length - 1 ? onClose : () => changePage(page + 1)}>{page === pages.length - 1 ? '返回牌局' : '下一頁'}</button></div>
  </section></div>
}
