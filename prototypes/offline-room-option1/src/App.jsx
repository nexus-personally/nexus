import { useState } from 'react';
import { ArrowsOut, BookOpen, Check, Copy, QrCode, SignOut, SpeakerHigh, User, UsersThree } from '@phosphor-icons/react';

const seats = [
  { number: '1', name: 'hw', note: '等待准备', player: true },
  { number: '2', name: '电脑补位', note: '开局时由电脑入座' },
  { number: '3', name: '电脑补位', note: '开局时由电脑入座' },
];

export function App() {
  const [step, setStep] = useState('invite');
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');
  const copyInvite = async () => {
    await navigator.clipboard?.writeText('港雀无网房间 5FA31E7A｜配对码 GQ-5FA31E7A');
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  const notify = (text) => { setMessage(text); window.setTimeout(() => setMessage(''), 1800); };

  return <main className="game-shell">
    <div className="scene-shade" />
    <header className="topbar">
      <div className="brand" aria-label="港雀"><strong>港雀</strong><span>香港麻雀 · 3D 牌桌</span></div>
      <div className="profile-pill">
        <div className="mahjong-avatar">發</div><span className="player-name">hw</span><span className="profile-divider" />
        <img src="/assets/gold-coin.png" alt="" /><span>妈币 500</span>
      </div>
      <nav className="utility-actions" aria-label="游戏设置">
        <button type="button" aria-label="全屏" onClick={() => notify('全屏模式')}><ArrowsOut weight="bold" /></button>
        <button type="button" aria-label="玩法说明" onClick={() => notify('玩法说明')}><BookOpen weight="fill" /></button>
        <button type="button" aria-label="声音设置" onClick={() => notify('声音设置')}><SpeakerHigh weight="fill" /></button>
      </nav>
    </header>

    <section className="room-stage" aria-label="无网房间">
      <div className="room-summary">
        <span className="summary-label">无网房间</span><strong>5FA31E7A</strong><span className="summary-divider" />
        <span className="online-dot" /><span className="waiting-copy">等待朋友加入</span>
        <button type="button" className="copy-code" onClick={copyInvite} aria-label="复制房间码">{copied ? <Check weight="bold" /> : <Copy weight="bold" />}</button>
      </div>

      <div className="room-grid">
        <section className="invite-panel panel-surface">
          <div className="step-tabs" role="tablist">
            <button className={step === 'invite' ? 'active' : ''} onClick={() => setStep('invite')} role="tab"><b>1</b><span>邀请朋友</span></button>
            <button className={step === 'response' ? 'active' : ''} onClick={() => setStep('response')} role="tab"><b>2</b><span>扫描回应</span></button>
          </div>
          {step === 'invite' ? <div className="invite-content">
            <p className="eyebrow">让朋友扫描二维码加入</p>
            <div className="qr-frame"><img src="/assets/offline-room-qr.png" alt="无网房间邀请二维码" /></div>
            <p className="scan-note">请朋友用手机扫描该二维码加入房间</p>
            <button type="button" className="wide-control" onClick={copyInvite}>{copied ? <><Check weight="bold" /> 已复制配对文字</> : <><Copy weight="bold" /> 复制配对文字</>}</button>
          </div> : <div className="response-content">
            <div className="scan-emblem"><QrCode weight="duotone" /></div><h2>扫描朋友手机的回应码</h2>
            <p>朋友完成邀请后，用本机相机扫描回应二维码。</p>
            <button type="button" className="wide-control" onClick={() => notify('相机扫描已开启')}><QrCode weight="bold" /> 开启相机扫描</button>
          </div>}
        </section>

        <aside className="seat-panel panel-surface">
          <div className="seat-heading"><div><span>房间座位</span><small>满员后即可进入牌桌</small></div><strong>3/3</strong></div>
          <div className="seat-list">{seats.map((seat) => <div className="seat-row" key={seat.number}>
            <span className="seat-number">{seat.number}</span>
            <span className={`seat-icon ${seat.player ? 'is-player' : ''}`}>{seat.player ? <User weight="fill" /> : <UsersThree weight="fill" />}</span>
            <span className="seat-copy"><b>{seat.name}</b><small>{seat.note}</small></span>{seat.player && <span className="ready-dot" />}
          </div>)}</div>
          <div className="room-hint"><span /> 好友加入后会显示在这里</div>
        </aside>
      </div>
      <div className="room-actions">
        <button className="primary-action" type="button" onClick={() => notify('已进入牌桌准备')}><Check weight="bold" />进入牌桌准备</button>
        <button className="secondary-action" type="button" onClick={() => notify('已离开房间')}><SignOut weight="bold" />离开房间</button>
      </div>
    </section>
    {message && <div className="toast" role="status">{message}</div>}
  </main>;
}
