import time
# Regression checks for Folio. Run before every deploy: python3 check.py
import json,re,subprocess,tempfile,os,sys
s=open('src/build.js').read()
i=s.index('const HTML = ');e=s.find('\n',i);e=len(s) if e<0 else e
html=json.loads(s[i+len('const HTML = '):e].rstrip().rstrip(';'))
bad=0
def ok(c,m):
    global bad
    print(('PASS ' if c else 'FAIL ')+m); bad+= (not c)
r=subprocess.run(['node','--check','src/build.js'],capture_output=True,text=True);ok(r.returncode==0,'build.js syntax '+r.stderr[:200])
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
ok(html.count('?"":" nocv"')==3 and '.row.nocv{grid-template-columns:28px 1fr}' in html and '<span></span>' not in html and ':nc(x)}' not in html,'rows: no-cover pieces use full width, no empty space')
sys.exit(1 if bad else 0)
ok('async function gameApi(' in s and 'if (p === "/api/game") return await gameApi' in s and 'id="gmc"' in html,'game: Who wrote it? API + Today card')
ok('async function wmApi(' in s and 'wmPing(env' in s and 'wmBox.style.display="block"' in html,'want more: API, new-piece ping, button shown')
ok('async function finApi(' in s and 'async function loyalApi(' in s and 'async function anonApi(' in s and 'if(e==="done")finPost(h)' in html and 'id="lyl"' in html,'loyal readers: finish record, list in Your stats, anonymous option')
ok("Today's Who wrote it? is ready." in s,'daily digest mentions the game')
