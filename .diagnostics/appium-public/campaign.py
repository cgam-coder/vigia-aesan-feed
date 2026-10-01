"""Owner-authorized Appium client: native actions, allowlisted read-only Preview observations.
Only a new disposable simulator may be supplied. No product source or production secrets.
"""
import base64, hashlib, json, re, socket, struct, time, urllib.error, urllib.parse, urllib.request
from pathlib import Path

ORIGIN = 'https://8c4df878-vigia-runtime.c-gamiz93.workers.dev'
CANDIDATE = 'df5ea1f2918ae232c22e7a31bb0866ab910eb881'
ELEMENT = 'element-6066-11e4-a52e-4f735466cecf'
# Static read-only expression. No event injection, preference writes, clicks or focus calls.
OBSERVE = r'''
if (location.origin !== 'https://8c4df878-vigia-runtime.c-gamiz93.workers.dev') throw Error('Outside authorized Preview');
const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
const info=e=>e?{tag:e.tagName,id:e.id,cls:typeof e.className==='string'?e.className:'',label:e.getAttribute('aria-label'),text:(e.innerText||e.textContent||'').slice(0,300),value:e.value||null,selected:e.getAttribute('aria-pressed'),disabled:e.disabled===true,box:rect(e),font:getComputedStyle(e).fontSize}:null;
const vv=visualViewport;const active=document.activeElement;
return {origin:location.origin,path:location.pathname,query:location.search,title:document.title,ready:document.readyState,
 theme:document.documentElement.getAttribute('data-na-theme'),osDark:matchMedia('(prefers-color-scheme: dark)').matches,
 storedTheme:localStorage.getItem('nagamealert-theme'),consent:localStorage.getItem('nagamealert.analytics-consent.v1'),
 analyticsScripts:Array.from(document.scripts).map(s=>s.src).filter(s=>/googletagmanager|google-analytics/.test(s)),
 active:info(active),search:info(document.querySelector('#global-alert-search')),filterTrigger:info(document.querySelector('.na-terminal-filter-trigger')),
 country:info(document.querySelector('#terminal-country')),countryOptions:Array.from(document.querySelectorAll('#terminal-country option')).map(e=>({value:e.value,label:e.textContent})),
 viewport:{width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,scrollY:scrollY,dpr:devicePixelRatio,scale:vv?vv.scale:null,visualWidth:vv?vv.width:null,visualHeight:vv?vv.height:null,offsetTop:vv?vv.offsetTop:null,offsetLeft:vv?vv.offsetLeft:null},
 header:info(document.querySelector('.na-public-header')),brand:info(document.querySelector('.na-public-brand')),themeButton:info(document.querySelector('.na-theme-toggle')),
 menu:info(document.querySelector('.na-public-mobile-nav summary')),menuOpen:!!document.querySelector('.na-public-mobile-nav[open]'),
 filterOpen:!!document.querySelector('[role=dialog][aria-labelledby*=filter]'),dialogs:Array.from(document.querySelectorAll('[role=dialog]')).map(info),
 resultsBusy:document.querySelector('.na-terminal-results')?.getAttribute('aria-busy'),resultsText:(document.querySelector('.na-terminal-results')?.innerText||'').slice(0,4000),h1:document.querySelector('h1')?.innerText||null,
 cards:Array.from(document.querySelectorAll('.na-terminal-results article.na-alert-card')).slice(0,30).map(e=>({text:e.innerText.slice(0,1100),id:e.getAttribute('data-alert-id'),selected:e.getAttribute('data-map-selected'),link:Array.from(e.querySelectorAll('a')).filter(a=>a.pathname.includes('/alerta/')).map(a=>({href:a.pathname,label:a.innerText})),mapButton:info(e.querySelector('.na-alert-card__map-action'))})),
 map:info(document.querySelector('.na-terminal-map__viewport')),mapPan:document.querySelector('.na-terminal-map__pan')?.style.transform||null,mapZoom:document.querySelector('.na-terminal-map__layer')?.style.transform||null,mapPanEnabled:document.querySelector('.na-terminal-map__viewport')?.getAttribute('data-touch-pan')||null,
 mapText:(document.querySelector('.na-terminal-map')?.innerText||'').slice(0,2400),mapButtons:Array.from(document.querySelectorAll('.na-terminal-map__controls button')).map(info),
 nativeTargetLabels:Array.from(document.querySelectorAll('button,a,summary,input,select')).filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height;}).slice(0,100).map(info)};
'''

class SetupError(RuntimeError): pass
class ProductError(AssertionError): pass
class BudgetError(RuntimeError): pass


def expect(condition, message):
    if not condition: raise ProductError(message)


def allowed_url(url):
    u=urllib.parse.urlsplit(url)
    return u.scheme=='https' and u.netloc==urllib.parse.urlsplit(ORIGIN).netloc and not u.fragment and (u.path in ('/es/alertas','/en/alerts','/es/fuentes','/es/metodologia') or u.path.startswith('/es/alerta/'))


def png_dimensions(raw):
    if len(raw)<24 or raw[:8]!=b'\x89PNG\r\n\x1a\n': raise SetupError('Not an original PNG')
    w,h=struct.unpack('>II',raw[16:24])
    if not (100<=w<=5000 and 100<=h<=5000): raise SetupError('Invalid screenshot dimensions')
    return w,h


class Client:
    def __init__(self,out,deadline):
        self.out=Path(out);self.deadline=deadline;self.sid=None;self.context=None;self.serial=0;self.commands=[];self.poisoned=False;self.network=[]
        self.out.mkdir(parents=True,exist_ok=True)
    def request(self,method,path,body=None,timeout=40,session=True):
        if time.monotonic()>=self.deadline: raise BudgetError('Test budget exhausted; recovery reserve protected')
        if self.poisoned and method!='DELETE': raise SetupError('Session transport stopped after timeout; no blind retry')
        if (not path.startswith('/') and not (method=='DELETE' and path=='')) or '..' in path: raise SetupError('Invalid WebDriver path')
        url='http://127.0.0.1:4723'+('/session/'+self.sid if session and self.sid else '')+path
        req=urllib.request.Request(url,data=json.dumps(body).encode() if body is not None else None,method=method,headers={'Content-Type':'application/json'})
        entry={'sequence':len(self.commands)+1,'method':method,'path':path,'startedMs':round(time.time()*1000)}
        self.commands.append(entry)
        try:
            try:
                with urllib.request.urlopen(req,timeout=max(1,min(timeout,self.deadline-time.monotonic()))) as r: raw=r.read(25_000_000)
            except urllib.error.HTTPError as e: raw=e.read(1_000_000)
            obj=json.loads(raw);value=obj.get('value')
            if isinstance(value,dict) and value.get('error'):
                raise SetupError(str(value['error'])+': '+str(value.get('message',''))[:800])
            entry['status']='COMPLETED';return value
        except (TimeoutError,socket.timeout,urllib.error.URLError) as e:
            self.poisoned=True;entry['status']='TRANSPORT_ERROR';raise SetupError('WebDriver transport: '+str(e)[:400]) from e
        except Exception as e:
            entry['status']='ERROR';entry['error']=str(e)[:1000];raise
        finally:
            entry['finishedMs']=round(time.time()*1000)
            (self.out/'commands.json').write_text(json.dumps(self.commands,indent=2))
    def create(self,udid,derived):
        if not re.fullmatch(r'[A-Fa-f0-9-]{36}',udid): raise SetupError('Invalid owned simulator')
        caps={'platformName':'iOS','browserName':'Safari','appium:automationName':'XCUITest','appium:udid':udid,'appium:platformVersion':'18.5','appium:deviceName':'iPhone 16',
          'appium:derivedDataPath':str(derived),'appium:useNewWDA':True,'appium:wdaStartupRetries':1,'appium:wdaLaunchTimeout':180000,'appium:wdaConnectionTimeout':45000,
          'appium:newCommandTimeout':180,'appium:waitForIdleTimeout':1,'appium:connectHardwareKeyboard':False,'appium:forceSimulatorSoftwareKeyboardPresence':True,
          'appium:showSafariNetworkLog':False,'appium:showSafariConsoleLog':False,'appium:skipLogCapture':False,'appium:safariInitialUrl':'about:blank','appium:webviewConnectRetries':4,
          'appium:showXcodeLog':False,'appium:allowProvisioningUpdates':False}
        value=self.request('POST','/session',{'capabilities':{'alwaysMatch':caps,'firstMatch':[{}]}},timeout=240,session=False)
        self.sid=value['sessionId'];self.context=None
        (self.out/'session.json').write_text(json.dumps({'sessionId':self.sid,'simulator':udid,'requestedCapabilities':caps,'actualCapabilities':value.get('capabilities',{})},indent=2))
    def native(self):
        if self.context!='NATIVE_APP':self.request('POST','/context',{'name':'NATIVE_APP'});self.context='NATIVE_APP'
    def web(self):
        names=self.request('GET','/contexts')
        web=[x for x in names if isinstance(x,str) and x!='NATIVE_APP']
        if not web:raise SetupError('Safari web context unavailable')
        errors=[]
        for name in web[:3]:
            try:
                self.request('POST','/context',{'name':name});self.context=name
                url=self.request('GET','/url')
                if allowed_url(url) or url=='about:blank': return url
            except SetupError as e: errors.append(str(e))
        raise SetupError('No authorized Safari page context: '+str(errors)[:400])
    def observe(self):
        self.web();return self.request('POST','/execute/sync',{'script':OBSERVE,'args':[]})
    def mobile(self,name,args):
        allowed={'activateApp','terminateApp','swipe','pinch','dragFromToForDuration','selectPickerWheelValue'}
        if name not in allowed:raise SetupError('Mobile method outside reviewed scope')
        if name in ('activateApp','terminateApp') and args.get('bundleId') not in ('com.apple.mobilesafari','com.apple.Preferences'):raise SetupError('Unexpected native application')
        self.native();return self.request('POST','/execute/sync',{'script':'mobile: '+name,'args':[args]})
    def elements(self,predicate):
        self.native();return self.request('POST','/elements',{'using':'-ios predicate string','value':predicate})
    def find(self,label=None,kind=None,timeout=8,contains=False):
        if label is None and kind is None:raise SetupError('Unscoped element query')
        quote=lambda s:json.dumps(s,ensure_ascii=False)
        pred='visible == 1'
        if label is not None:pred+=' AND (label '+('CONTAINS[c]' if contains else '==')+' '+quote(label)+' OR name == '+quote(label)+')'
        if kind:pred+=' AND type == '+quote(kind)
        end=min(self.deadline,time.monotonic()+timeout)
        while True:
            found=self.elements(pred)
            if len(found)==1:return found[0].get(ELEMENT,found[0].get('ELEMENT'))
            if len(found)>1:raise SetupError('Ambiguous visible native control: '+str(label or kind))
            if time.monotonic()>=end:raise SetupError('Native control absent: '+str(label or kind))
            time.sleep(.35)
    def click(self,label=None,kind=None,element=None):
        self.native();e=element or self.find(label,kind)
        self.request('POST','/element/'+e+'/click',{});time.sleep(.3);return e
    def type(self,e,text):
        self.native();self.request('POST','/element/'+e+'/value',{'text':text,'value':list(text)})
    def rect(self,e):self.native();return self.request('GET','/element/'+e+'/rect')
    def navigate(self,path='/es/alertas',native=False):
        url=ORIGIN+path
        if not allowed_url(url):raise SetupError('Navigation outside authorized Preview')
        self.mobile('activateApp',{'bundleId':'com.apple.mobilesafari'})
        if native:
            for title in ('Continue','Not Now'):
                try:self.click(element=self.find(title,timeout=.5))
                except SetupError:pass
            e=self.find(kind='XCUIElementTypeTextField',timeout=8)
            self.click(element=e);self.request('POST','/element/'+e+'/clear',{});self.type(e,url+'\n')
        else:
            self.web();self.request('POST','/url',{'url':url},timeout=50)
        return self.wait(lambda s:s['ready']=='complete' and s['theme'] in ('dark','light'),timeout=25)
    def wait(self,check,timeout=10):
        end=min(self.deadline,time.monotonic()+timeout);last=None
        while True:
            last=self.observe()
            if check(last):return last
            if time.monotonic()>=end:raise ProductError('Expected state not reached: '+json.dumps(last,ensure_ascii=False)[:1600])
            time.sleep(.4)
    def capture(self,name,state=None):
        if not re.fullmatch('[a-z0-9-]+',name):raise SetupError('Unsafe evidence name')
        if state is None:state=self.observe()
        self.native();raw=base64.b64decode(self.request('GET','/screenshot'),validate=True);w,h=png_dimensions(raw)
        self.serial+=1;stem=f'{self.serial:03d}-{name}'
        (self.out/(stem+'.png')).write_bytes(raw)
        meta={'timeMs':round(time.time()*1000),'sequence':self.serial,'screenshot':stem+'.png','sha256':hashlib.sha256(raw).hexdigest(),'width':w,'height':h,'observation':state}
        (self.out/(stem+'.json')).write_text(json.dumps(meta,ensure_ascii=False,indent=2));return meta
    def network_events(self):
        self.native();entries=self.request('POST','/log',{'type':'safariNetwork'})
        def walk(v):
            if isinstance(v,dict):
                for k,x in v.items():
                    if k=='url' and isinstance(x,str):
                        u=urllib.parse.urlsplit(x)
                        if u.scheme in ('http','https'):self.network.append({'host':u.netloc,'path':u.path,'timeMs':round(time.time()*1000)})
                    else:walk(x)
            elif isinstance(v,list):
                for x in v:walk(x)
            elif isinstance(v,str) and v.startswith(('{','[')):
                try:walk(json.loads(v))
                except ValueError:pass
        walk(entries);(self.out/'network-filtered.json').write_text(json.dumps(self.network,indent=2));return self.network
    def appearance(self,style):
        if style not in ('Light','Dark'):raise SetupError('Invalid appearance')
        self.mobile('activateApp',{'bundleId':'com.apple.Preferences'})
        self.native()
        # Native Settings only; never simctl ui or mobile:setAppearance.
        try:button=self.find(style,kind='XCUIElementTypeButton',timeout=1)
        except SetupError:
            try:e=self.find('Display & Brightness',timeout=3)
            except SetupError:
                self.mobile('swipe',{'direction':'up'});e=self.find('Display & Brightness',timeout=4)
            self.click(element=e);button=self.find(style,kind='XCUIElementTypeButton')
        self.click(element=button)
        self.capture('settings-'+style.lower(),{'application':'com.apple.Preferences','requestedAppearance':style,'verification':'Safari matchMedia still required'})
        self.mobile('activateApp',{'bundleId':'com.apple.mobilesafari'});time.sleep(.5)
    def close(self):
        if self.sid:
            # Cleanup has an independent deadline, supplied by the owner runner.
            try:self.request('DELETE','',timeout=25)
            finally:self.sid=None;self.context=None


class Matrix:
    def __init__(self,client,report):self.d=client;self.report=report
    def case(self,name,fn):
        result={'id':name,'status':'NOT_EXECUTED','visualReview':'PENDING','startedMs':round(time.time()*1000)}
        self.report.setdefault('cases',[]).append(result)
        if self.d.poisoned or self.d.deadline-time.monotonic()<35:
            result['reason']='Transport unavailable or recovery reserve';self.save();return
        try:
            result['status']='STARTED';self.save();fn();result['status']='ASSERTIONS_PASS'
        except ProductError as e:result.update(status='OBSERVED_FAILURE',reason=str(e))
        except Exception as e:result.update(status='HOLD_PREPARATION',reason=type(e).__name__+': '+str(e)[:1800])
        finally:
            result['endedMs']=round(time.time()*1000)
            if result['status']!='ASSERTIONS_PASS' and not self.d.poisoned:
                try:self.d.capture(name+'-failure')
                except Exception as e:result['captureError']=str(e)[:300]
            self.save()
    def save(self):(self.d.out/'matrix.json').write_text(json.dumps(self.report,ensure_ascii=False,indent=2))
    def ready(self,path='/es/alertas'):
        s=self.d.navigate(path)
        if s['dialogs']:raise SetupError('Consent or dialog blocks this independent case; no synthetic dismissal')
        return s
    def initial(self):
        s=self.d.navigate();expect(s['storedTheme'] is None and s['consent'] is None,'New session not clean')
        expect(s['origin']==ORIGIN,'Wrong origin');self.d.capture('clean-initial',s)
    def cold_dark(self):
        # This case proves cold product navigation, not an uninstrumented physical iPhone.
        self.d.appearance('Dark');self.d.mobile('terminateApp',{'bundleId':'com.apple.mobilesafari'})
        s=self.d.navigate(native=True)
        expect(s['storedTheme'] is None and s['osDark'] and s['theme']=='dark','Cold dark product load mismatch');self.d.capture('cold-dark',s)
    def consent(self,choice):
        s=self.d.navigate();expect(s['consent'] is None,'Consent fixture not fresh')
        self.d.capture('consent-'+choice+'-before',s)
        before=self.d.network_events()
        expect(any(x['host']==urllib.parse.urlsplit(ORIGIN).netloc for x in before),'Network positive control absent')
        self.d.click('Aceptar analítica' if choice=='accepted' else 'Rechazar analítica')
        s=self.d.wait(lambda s:not s['dialogs']);record=json.loads(s['consent'] or '{}')
        expect(record.get('choice')==choice and record.get('version')==1,'Stored consent does not match native selection')
        self.d.capture('consent-'+choice+'-clicked',s);s=self.d.navigate()
        expect(json.loads(s['consent'])['choice']==choice and not s['dialogs'],'Consent does not persist across navigation')
        # Preview analytics are intentionally disabled for both choices by origin policy.
        logs=self.d.network_events();expect(not s['analyticsScripts'],'Unexpected analytics script on Preview')
        expect(not any(re.search(r'(^|\.)(google-analytics\.com|googletagmanager\.com)$',x['host']) for x in logs),'Unexpected analytics traffic on Preview')
        self.d.capture('consent-'+choice+'-persisted',s)
    def manual(self):
        s=self.ready();before=s['theme'];label=s['themeButton']['label'];self.d.capture('theme-before',s)
        self.d.click(label);s=self.d.wait(lambda x:x['theme']!=before)
        chosen=s['theme'];expect(s['storedTheme']==chosen,'Manual theme not stored');self.d.capture('theme-selected',s)
        s=self.d.navigate();expect(s['theme']==chosen and s['storedTheme']==chosen,'Manual theme persistence failed');self.d.capture('theme-reload',s)
    def precedence(self):
        s=self.ready();chosen=s['storedTheme']
        if chosen not in ('light','dark'):raise SetupError('No independently established manual choice')
        self.d.appearance('Light' if s['osDark'] else 'Dark')
        t=self.d.wait(lambda x:x['osDark']!=s['osDark'])
        expect(t['theme']==chosen and t['storedTheme']==chosen,'OS overrode manual selection');self.d.capture('manual-os-change',t)
    def menu(self):
        s=self.ready();self.d.capture('menu-before',s);self.d.click('Menú');s=self.d.wait(lambda x:x['menuOpen']);self.d.capture('menu-open',s)
        self.d.click('Menú');s=self.d.wait(lambda x:not x['menuOpen']);self.d.capture('menu-closed',s)
    def filters(self):
        s=self.ready();self.d.click('Filtros');s=self.d.observe();self.d.capture('filters-open',s)
        country=s['country'];label=country['label'] or country['value']
        try:e=self.d.find('País',kind='XCUIElementTypePopUpButton',contains=True,timeout=2)
        except SetupError:e=self.d.find('Todos los países',kind='XCUIElementTypeButton',contains=True,timeout=3)
        self.d.click(element=e)
        try:wheel=self.d.find(kind='XCUIElementTypePickerWheel',timeout=2)
        except SetupError:self.d.click('España')
        else:
            self.d.type(wheel,'España')
            try:self.d.click(element=self.d.find('Done',timeout=1))
            except SetupError:pass
        s=self.d.wait(lambda x:x['country'] and x['country']['value']=='ES' and 'country=ES' in x['query'] and x['resultsBusy']!='true')
        self.d.capture('filters-applied',s);self.d.click('Restablecer filtros')
        s=self.d.wait(lambda x:'country=ES' not in x['query'] and x['country'] and x['country']['value']!='ES');self.d.capture('filters-reset',s)
        self.d.click('Ver resultados');s=self.d.wait(lambda x:x['active'] and 'na-terminal-filter-trigger' in x['active']['cls']);self.d.capture('filters-focus-restored',s)
    def keyboard(self):
        s=self.ready();scale=s['viewport']['scale'];self.d.capture('keyboard-before',s)
        try:e=self.d.find(kind='XCUIElementTypeSearchField')
        except SetupError:e=self.d.find('Buscar alertas',contains=True)
        self.d.click(element=e);k=self.d.find(kind='XCUIElementTypeKeyboard',timeout=5)
        s=self.d.observe();expect(s['active'] and s['active']['id']=='global-alert-search','Wrong DOM focus')
        expect(float(s['search']['font'].removesuffix('px'))>=16,'Input font under 16px')
        v=s['viewport'];r=s['search']['box'];expect(abs(v['scale']-scale)<.03,'Unexpected zoom on focus')
        expect(r['y']>=v['offsetTop']-1 and r['bottom']<=v['offsetTop']+v['visualHeight']+1,'Field cropped by visual viewport')
        s['nativeKeyboardFrame']=self.d.rect(k);self.d.capture('keyboard-focused',s)
        self.d.type(e,'cacahuete\n');s=self.d.wait(lambda x:'q=cacahuete' in x['query'] and 'cacahuete' in x['resultsText'].lower(),timeout=20);self.d.capture('search-results',s)
    def orientation(self):
        self.ready();self.d.native();self.d.request('POST','/orientation',{'orientation':'LANDSCAPE'});time.sleep(.5);s=self.d.observe()
        expect(s['viewport']['width']>s['viewport']['height'] and s['viewport']['documentWidth']<=s['viewport']['width']+1,'Landscape overflow or rotation missing');self.d.capture('landscape',s)
        self.d.native();self.d.request('POST','/orientation',{'orientation':'PORTRAIT'});time.sleep(.5);s=self.d.observe();expect(s['viewport']['width']<s['viewport']['height'],'Portrait not restored');self.d.capture('portrait',s)
    def scroll(self):
        s=self.ready();self.d.capture('scroll-before',s);self.d.mobile('swipe',{'direction':'up'});s=self.d.observe()
        expect(s['viewport']['scrollY']>20,'Page did not scroll');self.d.capture('scroll-down',s)
        self.d.mobile('swipe',{'direction':'down'});s=self.d.observe();self.d.capture('scroll-return',s)
        expect(s['viewport']['documentWidth']<=s['viewport']['width']+1,'Scroll revealed overflow')
    def pinch(self):
        s=self.ready();start=s['viewport']['scale'];self.d.capture('pinch-before',s)
        web=self.d.find(kind='XCUIElementTypeWebView');self.d.mobile('pinch',{'elementId':web,'scale':1.3,'velocity':1});s=self.d.observe()
        expect(s['viewport']['scale']>start*1.1,'Pinch produced no page scale change');self.d.capture('pinch-zoomed',s)
        self.d.mobile('pinch',{'elementId':web,'scale':start/s['viewport']['scale'],'velocity':-1});s=self.d.observe()
        expect(abs(s['viewport']['scale']-start)<.12,'Pinch scale not restored');self.d.capture('pinch-restored',s)
    def map_detail(self):
        s=self.ready('/es/alertas?source=AESAN&q=cacahuete')
        cards=[c for c in s['cards'] if c['mapButton'] and c['link']]
        if not cards:raise SetupError('No map-ready live Preview record; feed identity is insufficient')
        # Freeze the identity and require an unambiguous native target, not a random card.
        if len(cards)!=1:
            ref=re.search(r'ES[0-9]{4}/[0-9]+',cards[0]['text'])
            if not ref:raise SetupError('Multiple map fixtures without a usable reference')
            s=self.ready('/es/alertas?source=AESAN&q='+urllib.parse.quote(ref.group(0),safe=''))
            cards=[c for c in s['cards'] if c['mapButton'] and c['link'] and ref.group(0) in c['text']]
        if len(cards)!=1:raise SetupError('Live map fixture not uniquely identified')
        card=cards[0];self.report['mapFixture']=card;self.save()
        label=card['mapButton']['label'] or card['mapButton']['text']
        try:e=self.d.find(label,timeout=2)
        except SetupError:self.d.mobile('swipe',{'direction':'up'});e=self.d.find(label)
        self.d.capture('map-before',s);self.d.click(element=e)
        s=self.d.wait(lambda x:any(c['selected']=='true' for c in x['cards']) and x['map'] is not None,timeout=15)
        expect(bool(s['mapText']),'Map selection has no visible content');self.d.capture('map-selected',s)
        beforeZoom=s['mapZoom'];self.d.click(s['mapButtons'][0]['label'])
        s=self.d.wait(lambda x:x['mapZoom']!=beforeZoom and not x['mapButtons'][1]['disabled']);self.d.capture('map-zoomed',s)
        self.d.click(s['mapButtons'][-1]['label']);s=self.d.wait(lambda x:x['mapButtons'][1]['disabled']);self.d.capture('map-zoom-reset',s)
        self.d.click('Activar o desactivar el desplazamiento táctil del mapa');s=self.d.wait(lambda x:x['mapPanEnabled'] is not None)
        before=s['mapPan'];pageY=s['viewport']['scrollY'];group=self.d.find(s['map']['label'],kind='XCUIElementTypeOther',timeout=3)
        r=self.d.rect(group);self.d.mobile('dragFromToForDuration',{'duration':.5,'fromX':r['x']+r['width']*.5,'fromY':r['y']+r['height']*.5,'toX':r['x']+r['width']*.7,'toY':r['y']+r['height']*.5})
        s=self.d.observe();expect(s['mapPan']!=before and abs(s['viewport']['scrollY']-pageY)<5,'Map pan not distinguished from page scroll');self.d.capture('map-panned',s)
        buttons=s['mapButtons'];reset=buttons[-1]['label'];self.d.click(reset);s=self.d.wait(lambda x:x['mapPan']=='translate(0px, 0px)' and x['mapButtons'][1]['disabled']);self.d.capture('map-reset',s)
        link=card['link'][0];self.d.click(link['label']);s=self.d.wait(lambda x:x['path']==link['href'],timeout=15)
        expect(bool(s['h1']) and 'cacahuete' in s['h1'].lower(),'Wrong detail content');self.d.capture('detail-opened',s)
        self.d.click('Back');s=self.d.wait(lambda x:x['path']=='/es/alertas',timeout=12);self.d.capture('detail-back',s)
    def execute(self,choice):
        if choice=='rejected':self.case('cold-dark-first-product-load',self.cold_dark)
        self.case('capability-and-clean-preview',self.initial)
        self.case('consent-'+choice,lambda:self.consent(choice))
        if choice=='rejected':
            for name,fn in [('manual-theme',self.manual),('manual-os-precedence',self.precedence),('menu',self.menu),('filters-focus',self.filters),('keyboard-zoom-search',self.keyboard),('rotation',self.orientation),('scroll-sticky',self.scroll),('pinch',self.pinch)]:self.case(name,fn)
        else:self.case('map-pan-detail-return',self.map_detail)
        self.report['productGate']='HOLD_PENDING_EVIDENCE_REVIEW'
        self.save()
