import time
# Regression checks for Folio. Run before every deploy: python3 check.py
import json,re,subprocess,tempfile,os,sys
s=open('/workspace/work/folio/src/build.js').read()
i=s.index('const HTML = ');e=s.find('\n',i);e=len(s) if e<0 else e
html=json.loads(s[i+len('const HTML = '):e].rstrip().rstrip(';'))
bad=0
def ok(c,m):
    global bad
    print(('PASS ' if c else 'FAIL ')+m); bad+= (not c)
r=subprocess.run(['node','--check','/workspace/work/folio/src/build.js'],capture_output=True,text=True);ok(r.returncode==0,'build.js syntax '+r.stderr[:200])
for n,(attr,body) in enumerate(re.findall(r'<script([^>]*)>(.*?)</script>',html,re.S)):
    f=tempfile.mktemp(suffix='.mjs' if 'module' in attr else '.js');open(f,'w').write(body)
    r=subprocess.run(['node','--check',f],capture_output=True,text=True);ok(r.returncode==0,f'inline script {n} syntax '+r.stderr[:300]);os.remove(f)
ok('ST_MAX=6,ST_DUR=10000' in html,'stories: 6 max, 10 s each')
ok('return out.slice(0,ST_MAX)' in html,'stories: list capped')
ok('Summarizing\\u2026</li></ul>' not in html,'stories: no stuck Summarizing placeholder')
ok('document.hidden){stT0+=dt' in html,'stories: pause in background')
ok('if(!added&&!cur)p.style.display' in html,'add banner: not shown after adding')
ok('Pull to refresh' not in html,'feed: retry instead of pull to refresh')
ok("typeof qaTok==='function'" not in html,'report: token sent')
ok('airdrops work' not in html,'ask: placeholder')
ok('$("#back").onclick=()=>{closeReader();' in html,'reader: Back closes directly (works in Farcaster web iframe)')
ok('if(skipPop){skipPop=false;return}' in html,'reader: no reopen after Back')
ok('setTimeout(()=>r(null),30000)' in html,'auth: token request can not hang')
ok("t confirm your sign-in. If it asked you" in html,'ask: clear message when sign-in not confirmed')
ok('ac.abort(),60000' in html,'ask: request timeout')
ok('if(!mob&&!qaHave)return null' in html and html.count('qaTok(1)')>=5,'auth: background calls never pop wallet prompt on web')
ok('return J({ error: "not found" }, 404' in s,'api: missing article is 404 not 500')
ok('r.status===404)break' in html,'reader: no retry loop on missing article')
# audit 2026-11-18: fast, safe mini app start
ok('_imp(\"/js/sdk-040.mjs\"' in html.replace('"','\\"') or '_imp("/js/sdk-040.mjs"' in html,'start: SDK from own origin first')
ok('await import("https://esm.sh' not in html,'start: no blocking esm.sh import without timeout')
ok('_imp("https://esm.sh/@farcaster/miniapp-sdk@0.4.0",7000)' in html,'start: esm.sh fallback with timeout')
ok('rel="modulepreload" href="/js/sdk-040.mjs"' in html,'start: SDK preloaded with the page')
ok('window._feedP=fetch("/api/feed")' in html and 'const fp=window._feedP' in html,'start: feed fetched in parallel with SDK')
ok(not re.search(r'<link rel="stylesheet"(?![^>]*media="print")[^>]*fonts.googleapis',html),'start: Google Fonts never block first paint')
ok('await _T(sdk.actions.ready(),900)' in html,'start: ready() still called')
ok('pathname === "/js/sdk-040.mjs") return sdkJs' in s and 'js:sdk-040' in s,'start: /js/sdk-040.mjs route')
ok('if (e && e.nf) return J({ error: "not found" }, 404);' in s,'api: not-found errors map to 404 everywhere')
ok('data-t="library"' in html and 'window.__freq=()=>show("requests")' in html,'nav: Library tab, Requests under Writers')
ok('id="covbtn"' in html or 'ib.id="covbtn"' in html,'nav: cover icon in header')
if not os.environ.get('NOPROBE'):
  r=subprocess.run(['sh','/workspace/work/folio/api_probe.sh'],capture_output=True,text=True);
  print(r.stdout[-1500:] if r.returncode else '');ok(r.returncode==0,'live API probe: no 5xx (reflects deployed version)')
# simulate story pick on the live feed
js=html[html.index('const stPick=()=>{'):html.index('function storyBar(){')]
sim='const data=JSON.parse(require("fs").readFileSync(0,"utf8"));const ST_MAX=6;const allItems=()=>{const m=new Map();for(const k of["today","week","latest"])for(const x of data[k]||[])if(!m.has(x.h))m.set(x.h,x);return[...m.values()]};'+js+'const L=stPick();console.log(JSON.stringify({n:L.length,u:L.map(x=>x.a.u+(x._ft?"*":x._nv?"+":""))}))'
feed=subprocess.run(['curl','-s','https://folio.pedieth.workers.dev/api/feed'],capture_output=True,text=True).stdout
r=subprocess.run(['node','-e',sim],input=feed,capture_output=True,text=True);print(r.stdout.strip(),r.stderr[:200])
try:
    o=json.loads(r.stdout);ok(o['n']<=6 and len(set(x.rstrip('*+') for x in o['u']))==o['n'],'stories: at most 6, one per writer')
except Exception as x: ok(False,'stories sim '+str(x))
ok('PIN=["0xb8723ebf145b85e128165c0ca9f70a0f982f897b"]' in html and (o['u'][0]=='pk*' or time.time()*1000-1794742982000>2*864e5),'stories: Building Folio part one pinned first as Featured (2-day pin, expired ok)')
ok('.stb .rg .rgt{' in html and '.sto .tcard{' in html and 'pf0' not in html,'stories: no-cover article gets a title card (no preview text)')
ok("c.textContent='Support \\uD83D\\uDCB0 +'+(j.n||0)" in html and "'Supporters " not in html,'author support button reads Support +N')
ok('sdk.back.onback=()=>{if(cur)closeReader()}' in html,'Farcaster back button closes the reader (sdk.back)')
ok("async function rpLoad()" in html and "-webkit-line-clamp:2" in html and "!j.l.length)return" in html,'replies: max 3 compact replies under rating, hidden when none')
ok('Date.now()-(window._lo||0)<4000' in html and 'window._lo=Date.now();history.pushState({a:h},"",location.pathname)' in html and '"?a="+h)' not in html,'reader: late back-event right after opening does not close the article')
ok('function top1(arr, n)' in s and 'demoteFC(top1(' in s and 'const wHead = top1(wSorted, 12)' in s,'Today/Week: one piece per writer in top places, newest piece replaces older')
ok('const TEAM_FIDS = [1, 16447]' in s and s.count('!isTeam(x)')>=4 and 'From Farcaster &amp; Folio' in html and 'data.team.slice(0,2)' in html,'team (@pk, @farcaster) not ranked; small Not ranked section at end of Today')
ok('family=Inter:wght@400;500;600;700&family=Spectral' in html and '--title:\\"Inter\\"' in s and '.row h3{font-family:var(--title)' in html and 'article.r h1{font-family:var(--title)' in html and '--serif:\\"Spectral\\"' in s,'fonts: list titles Inter, reading text Spectral')
ok(html.count('?"":" nocv"')==3 and '.row.nocv{grid-template-columns:28px minmax(0,1fr)}' in html and '<span></span>' not in html and ':nc(x)}' not in html,'rows: no-cover pieces use full width, no empty space')
ok('.row{display:grid;grid-template-columns:28px minmax(0,1fr) 84px;' in html and 'overflow-wrap:anywhere}\nhtml,body{overflow-x:clip}' in html,'rows: long unbroken titles/URLs never widen the page (no sideways shake)')
# Zero Hour (sealed texts) 2026-11-19
r=subprocess.run(['node','/workspace/work/folio/e2e/zh_unit.mjs'],capture_output=True,text=True)
ok(r.returncode==0,'zero hour: server unit test (no body before open, withdraw blocked after half, open date 1 day to 1 year, auth, cap) '+(r.stdout.strip().splitlines() or [''])[-1]+' '+' | '.join(l for l in r.stdout.splitlines() if l.startswith('FAIL'))[:300])
zb=s[s.index('// ==== ZERO HOUR (sealed texts) START'):s.index('// ==== ZERO HOUR (sealed texts) END')]
ok(zb.count('"b:" + x.id)')==2 and zb.count('"b:" + id')==1 and 'async function slBodyIfOpen(env, x) { if (slSt(x) !== "open") return null; const b = await env.KV.get(slP(env) + "b:" + x.id)' in zb and zb.count('env.KV.get(slP(env) + "b:"')==1,'zero hour: body key read only through slBodyIfOpen')
ok('if (Date.now() >= slHalf(x)) return J({ error: "locked"' in zb and 'oa < nowT + DAY - 6e5 || oa > nowT + 366 * DAY' in zb,'zero hour: withdraw half-way lock + open date range in code')
ok('if (p === "/api/sealed") return await slApi(env, req, url);' in s and 'ctx.waitUntil(slTick(env' in s and 'id="zhtop"' in html and 'See all Zero Hour texts' in html and 'window.__zhOpen=zopen' in html,'zero hour: route, cron hook, Today card, list page')
if not os.environ.get('NOPROBE'):
  try:
    import urllib.request
    j=json.loads(urllib.request.urlopen(urllib.request.Request('https://folio.pedieth.workers.dev/api/sealed',headers={'user-agent':'curl/8.5'}),timeout=20).read())
    ok(all('b' not in x for x in j.get('items',[]) if x.get('st')!='open'),'zero hour live: no body for sealed items in /api/sealed')
    try: urllib.request.urlopen(urllib.request.Request('https://folio.pedieth.workers.dev/api/sealed',data=b'{"do":"seal"}',method='POST',headers={'content-type':'application/json','user-agent':'curl/8.5'}),timeout=20); ok(False,'zero hour live: unauthenticated POST rejected')
    except urllib.error.HTTPError as x: ok(x.code==401,'zero hour live: unauthenticated POST rejected ('+str(x.code)+')')
  except Exception as x: ok(False,'zero hour live probe '+str(x)[:120])
ok('async function gameApi(' in s and 'if (p === "/api/game") return await gameApi' in s and 'id="gmc"' in html,'game: Who wrote it? API + Today card')
ok('async function wmApi(' in s and 'wmPing(env' in s and 'wmBox.style.display="block"' in html,'want more: API, new-piece ping, button shown')
ok('async function finApi(' in s and 'async function loyalApi(' in s and 'async function anonApi(' in s and 'if(e==="done")finPost(h)' in html and 'id="lyl"' in html,'loyal readers: finish record, list in Your stats, anonymous option')
ok("Today's Who wrote it? is ready." in s,'daily digest mentions the game')
# Letters (2026-11-25): anonymous letters, card under Who wrote it? on Today
r=subprocess.run(['node','e2e/letters_unit.mjs'],capture_output=True,text=True,cwd='/workspace/work/folio');ok(r.returncode==0,'letters: server unit test (privacy, 1/day, inbox, hugs, my letters) '+' | '.join(l for l in r.stdout.splitlines() if l.startswith('FAIL'))[:300])
ok('if (p.startsWith("/api/letters/")) return await handleLetters(req, env, r => qaFid(r, url));' in s and 'import { handleLetters } from "./letters.mjs";' in s,'letters: route + import')
ok('id="ltc"' in html and 'id="ltrow"' not in html.split('const ltPut')[0][-50:] and 'r.id="ltrow"' in html and 'data-t="letters"' not in html,'letters: Today card next to Who wrote it?, no extra nav tab')
lm=open('/workspace/work/folio/src/letters.mjs').read()
ok(not any('console.' in l for l in lm.splitlines() if not l.strip().startswith('//')) and 'INSERT INTO letters (id, body, tag, mbox_hash, publish_at, share)' in lm,'letters: no logging, letter row has no fid')
sys.exit(1 if bad else 0)
